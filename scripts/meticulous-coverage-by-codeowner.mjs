#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import constants from './codeowners-manifest/constants.js';
import coverageFiles from './codeowners-manifest/coverage-files.js';

const { CODEOWNERS_BY_FILENAME_JSON_PATH } = constants;

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const INSTALL = 'npm install --global @alwaysmeticulous/cli@latest';
const TOKEN_HELP =
  'Create a Grafana API token at https://app.meticulous.ai/settings/grafana/projects/grafana/api-tokens\n' +
  'Set METICULOUS_API_TOKEN in your local shell configuration, then restart your shell. Do not store it in the repository.';
const PAGE_SIZE = 1000;

function redact(message, token) {
  return token ? message.split(token).join('[REDACTED]') : message;
}

async function runCli(args, env = process.env) {
  try {
    const { stdout } = await execFileAsync('meticulous', args, {
      cwd: ROOT,
      env,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 12 * 60 * 1000,
    });
    return stdout;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Meticulous CLI was not found on PATH. Install it yourself:\n${INSTALL}`);
    }
    const detail = redact(String(error.stderr || error.message), env.METICULOUS_API_TOKEN);
    throw new Error(`Meticulous CLI failed: ${detail}\nTo update the CLI: ${INSTALL}\n${TOKEN_HELP}`);
  }
}

function normalizePath(filename) {
  const normalized = path.posix.normalize(filename.replace(/\\/g, '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error('Expected a repository-relative coverage path.');
  }
  return normalized;
}

function parseCoveragePage(output, includeRanges = false) {
  const [header, ...lines] = output.replace(/[\r\n]+$/, '').split(/\r?\n/);
  const columns = header.split('\t');
  const required = ['repoFilePath', 'executedLines', 'executableLines'];
  if (includeRanges) {
    required.push('executedRanges', 'executableRanges');
  }
  if (required.some((column) => columns.filter((value) => value === column).length !== 1)) {
    throw new Error(`Invalid Meticulous coverage columns. Update the CLI: ${INSTALL}`);
  }
  return lines.map((line) => {
    const cells = line.split('\t');
    const value = (column) => cells[columns.indexOf(column)];
    const executedLines = Number(value('executedLines'));
    const executableLines = Number(value('executableLines'));
    if (
      cells.length !== columns.length ||
      !value('repoFilePath') ||
      !/^\d+$/.test(value('executedLines')) ||
      !/^\d+$/.test(value('executableLines')) ||
      !Number.isSafeInteger(executedLines) ||
      !Number.isSafeInteger(executableLines) ||
      executedLines > executableLines
    ) {
      throw new Error('Invalid Meticulous coverage row; no totals were generated.');
    }
    return {
      path: normalizePath(value('repoFilePath')),
      executedLines,
      executableLines,
      ...(includeRanges
        ? {
            executedRanges: parseLineRanges(value('executedRanges')),
            executableRanges: parseLineRanges(value('executableRanges')),
          }
        : {}),
    };
  });
}

function parseLineRanges(value) {
  if (value === '') {
    return [];
  }
  return value.split(';').map((range) => {
    if (!/^\d+(?:-\d+)?$/.test(range)) {
      throw new Error('Invalid Meticulous line range.');
    }
    const [start, end = start] = range.split('-').map(Number);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) {
      throw new Error('Invalid Meticulous line range.');
    }
    return [start, end];
  });
}

async function fetchCoverage(testRunId, cli = runCli, includeRanges = false) {
  const selector = testRunId ? [`--testRunId=${testRunId}`] : ['--latestForProject'];
  const base = ['agent', 'js-coverage', '--project=grafana/grafana'];
  const rawSummary = await cli([...base, ...selector, '--summary', '--json']);
  let source;
  try {
    source = JSON.parse(rawSummary);
  } catch {
    throw new Error(`Invalid Meticulous coverage summary. Update the CLI: ${INSTALL}`);
  }
  if (source?.status === 'processing') {
    throw new Error('Meticulous coverage is still processing. Try again when the run has finished.');
  }
  if (source == null) {
    throw new Error('No successful test run with coverage was found for grafana/grafana.');
  }
  if (typeof source.testRunId !== 'string' || !source.testRunId || (testRunId && source.testRunId !== testRunId)) {
    throw new Error('Invalid Meticulous coverage run ID; no totals were generated.');
  }

  const files = [];
  const seen = new Set();
  // Pin all pages to the resolved run, even if the project's latest run changes during the fetch.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = parseCoveragePage(
      await cli([
        ...base,
        `--testRunId=${source.testRunId}`,
        '--includeAllFiles',
        '--includeLineCounts',
        ...(includeRanges ? ['--includeExecutedRanges', '--includeExecutableRanges'] : []),
        '--orderBy=repoFilePath',
        '--order=asc',
        `--limit=${PAGE_SIZE}`,
        `--offset=${offset}`,
      ]),
      includeRanges
    );
    if (page.length > PAGE_SIZE || page.some((file) => seen.has(file.path))) {
      throw new Error('Inconsistent Meticulous pagination; no totals were generated.');
    }
    for (const file of page) {
      if (seen.has(file.path)) {
        throw new Error('Duplicate Meticulous coverage path; no totals were generated.');
      }
      seen.add(file.path);
      files.push(file);
    }
    if (page.length < PAGE_SIZE) {
      return { source, files: files.filter((file) => coverageFiles.isCoverageSourceFile(file.path)) };
    }
  }
}

function attributeCoverage(files, manifest) {
  const ownersByPath = new Map();
  const teams = new Map();
  for (const [filename, owners] of Object.entries(manifest)) {
    const teamOwners = [...new Set(owners.filter((owner) => owner.startsWith('@grafana/')))];
    ownersByPath.set(normalizePath(filename), teamOwners);
    for (const team of teamOwners) {
      if (!teams.has(team)) {
        teams.set(team, []);
      }
    }
  }
  const unowned = [];
  for (const file of files) {
    const owners = ownersByPath.get(file.path) || [];
    if (owners.length === 0) {
      unowned.push(file);
    }
    for (const team of owners) {
      teams.get(team).push(file);
    }
  }
  return { teams, unowned };
}

function totals(files) {
  const executedLines = files.reduce((sum, file) => sum + file.executedLines, 0);
  const executableLines = files.reduce((sum, file) => sum + file.executableLines, 0);
  return [
    String(files.length),
    String(executedLines),
    String(executableLines),
    files.length === 0
      ? 'No coverage data'
      : executableLines === 0
        ? 'N/A'
        : `${((100 * executedLines) / executableLines).toFixed(2)}%`,
  ];
}

function renderTable(rows) {
  const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => row[index].length)));
  return rows
    .map((row) =>
      row
        .map((cell, index) => cell.padEnd(widths[index]))
        .join('  ')
        .trimEnd()
    )
    .join('\n');
}

function renderReport({ source, files }, manifest, team) {
  const { teams, unowned } = attributeCoverage(files, manifest);
  if (team && !teams.has(team)) {
    throw new Error(`Codeowner "${team}" was not found among Grafana teams.`);
  }
  const header = ['Team', 'Files', 'Covered lines', 'Executable lines', 'Coverage'];
  const rows = team
    ? [header, [team, ...totals(teams.get(team))]]
    : [
        header,
        ...[...teams.keys()].sort().map((name) => [name, ...totals(teams.get(name))]),
        ['No Grafana team / unmatched', ...totals(unowned)],
        ['Overall (unique files)', ...totals(files)],
      ];
  const sections = [
    `Meticulous coverage: grafana/grafana, run ${source.testRunId}${source.commitSha ? `, commit ${source.commitSha}` : ''}`,
    'Ownership: current checkout. Shared files count for each owner; team totals can overlap.',
    'Jest codeowner source exclusions applied. Only eligible files returned by Meticulous are counted.',
    'Missing files are unknown, not zero-covered.',
  ];
  if (source.filesFailedToParse > 0) {
    sections.push(
      `Warning: Meticulous could not parse ${source.filesFailedToParse} files; coverage may be incomplete.`
    );
  }
  sections.push(renderTable(rows));
  return sections.join('\n\n');
}

async function main(args = process.argv.slice(2)) {
  const { default: yargs } = await import('yargs/yargs');
  const argv = yargs(args)
    .scriptName('pnpm test:coverage:meticulous:by-codeowner')
    .usage('$0 [team] [--test-run-id <id>]')
    .option('test-run-id', {
      type: 'string',
      description: 'Use a specific test run instead of latest project coverage',
    })
    .option('open', {
      type: 'boolean',
      default: process.env.CI !== 'true',
      description: 'Open team HTML report in the browser (use --no-open to disable)',
    })
    .check((args) => {
      if (args._.length > 1 || args['test-run-id'] === '') {
        throw new Error('Provide at most one team and a nonempty --test-run-id.');
      }
      return true;
    })
    .strictOptions()
    .help()
    .version(false)
    .parse();

  await runReport(argv._[0], argv['test-run-id'], argv.open);
}

async function runReport(team, testRunId, shouldOpen = process.env.CI !== 'true') {
  await runCli(['--version']);
  if (!process.env.METICULOUS_API_TOKEN?.trim()) {
    throw new Error(`METICULOUS_API_TOKEN is required.\n${TOKEN_HELP}`);
  }
  await execFileAsync(process.execPath, [path.join(SCRIPT_DIR, 'codeowners-manifest/index.js')], {
    cwd: ROOT,
  });
  const manifest = JSON.parse(await readFile(path.join(ROOT, CODEOWNERS_BY_FILENAME_JSON_PATH), 'utf8'));
  if (team && !attributeCoverage([], manifest).teams.has(team)) {
    throw new Error(`Codeowner "${team}" was not found among Grafana teams.`);
  }
  console.error('Fetching Meticulous coverage for grafana/grafana...');
  const coverage = await fetchCoverage(testRunId, runCli, Boolean(team));
  let reportURL;
  if (team) {
    const { writeTeamReport } = await import('./meticulous-coverage-report.mjs');
    const files = attributeCoverage(coverage.files, manifest).teams.get(team);
    reportURL = await writeTeamReport({ ...coverage, files }, team, { repoRoot: ROOT, shouldOpen });
  }
  console.log(renderReport(coverage, manifest, team));
  if (reportURL) {
    console.log(`Coverage report saved to ${reportURL}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(redact(error.message, process.env.METICULOUS_API_TOKEN));
    process.exitCode = 1;
  });
}

export { runCli, parseCoveragePage, fetchCoverage, attributeCoverage, renderReport, runReport };
