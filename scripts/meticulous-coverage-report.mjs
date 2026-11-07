import { CoverageReport } from 'monocart-coverage-reports';
import { execFile } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import open from 'open';

import codeowners from './codeowners-manifest/utils.js';

const execFileAsync = promisify(execFile);
const LINE_NOTE =
  'Line coverage only. Each executable line is represented as a synthetic statement. Hits are binary (covered/uncovered), not execution counts. Branch and function coverage are unavailable. Ownership comes from the current checkout. Jest codeowner source exclusions are applied.';

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]
  );
}

function expandRanges(ranges, lineCount) {
  const lines = new Set();
  for (const [start, end] of ranges) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > lineCount) {
      throw new Error('Coverage ranges do not match the source at the reported commit.');
    }
    for (let line = start; line <= end; line++) {
      lines.add(line);
    }
  }
  return lines;
}

function toIstanbul(file, sourceText) {
  const sourceLines = sourceText.split(/\r?\n/);
  const executable = expandRanges(file.executableRanges, sourceLines.length);
  const executed = expandRanges(file.executedRanges, sourceLines.length);
  if (
    executable.size !== file.executableLines ||
    executed.size !== file.executedLines ||
    [...executed].some((line) => !executable.has(line))
  ) {
    throw new Error(`Coverage ranges and line counts disagree for ${file.path}.`);
  }
  const statementMap = {};
  const s = {};
  // Istanbul derives line coverage from statements; these represent lines, not parsed JS statements.
  for (const line of executable) {
    statementMap[line] = { start: { line, column: 0 }, end: { line, column: sourceLines[line - 1].length } };
    s[line] = executed.has(line) ? 1 : 0;
  }
  return { path: file.path, statementMap, s, fnMap: {}, f: {}, branchMap: {}, b: {} };
}

async function annotateHtml(directory, banner) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await annotateHtml(filename, banner);
    } else if (entry.name.endsWith('.html')) {
      const html = await readFile(filename, 'utf8');
      // html-spa limits overview metrics, but its source pages use the standard four-metric header.
      const linesOnly = html.replace(
        /<div class='fl pad1y space-right2'>\s*<span class="strong">[^<]*<\/span>\s*<span class="quiet">(?:Statements|Branches|Functions)<\/span>\s*<span class='fraction'>[^<]*<\/span>\s*<\/div>/g,
        ''
      );
      await writeFile(
        filename,
        linesOnly.replace(/<body[^>]*>/, (body) => `${body}${banner}`)
      );
    }
  }
}

async function writeTeamReport({ source, files }, team, { repoRoot, outputDir, shouldOpen = false }) {
  if (files.length === 0) {
    return null;
  }
  const commit = source.commitSha;
  if (typeof commit !== 'string' || !/^[a-f\d]{40,64}$/i.test(commit)) {
    throw new Error('Meticulous did not provide a full source commit SHA; cannot generate source coverage.');
  }
  const sources = new Map();
  const coverageMap = {};
  for (const file of files) {
    let stdout;
    try {
      ({ stdout } = await execFileAsync('git', ['show', `${commit}:${file.path}`], {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      }));
    } catch {
      throw new Error(
        `Cannot read ${file.path} at ${commit}. Fetch the coverage run's commit into this repository and retry.`
      );
    }
    const filename = path.resolve(repoRoot, file.path);
    sources.set(filename, stdout);
    coverageMap[filename] = { ...toIstanbul(file, stdout), path: filename };
  }
  const directory =
    outputDir ?? path.join(repoRoot, 'coverage/meticulous/by-team', codeowners.buildCodeownerDirectoryPath(team));
  const report = new CoverageReport({
    name: `Meticulous line coverage - ${team}`,
    outputDir: directory,
    reports: [['html-spa', { subdir: 'html', metricsToShow: ['lines'] }]],
    // Supply source directly: Monocart otherwise reads disk before calling sourceFinder.
    fileSources: Object.fromEntries([...sources].map(([filename, source]) => [filename, source || '\n'])),
    logging: 'off',
  });
  report.cleanCache();
  await report.add(coverageMap);
  report.clean();
  await report.generate();
  const banner = `<aside style="padding:16px;background:#eef4ff;color:#172554;font:14px sans-serif"><strong>${escapeHtml(team)} — Meticulous line coverage</strong><p>Run ${escapeHtml(source.testRunId)} · Source commit ${escapeHtml(commit)}</p><p>${LINE_NOTE}</p>${source.filesFailedToParse ? `<p>Warning: Meticulous could not parse ${escapeHtml(source.filesFailedToParse)} files across this run.</p>` : ''}</aside>`;
  await annotateHtml(path.join(directory, 'html'), banner);
  const reportURL = pathToFileURL(path.join(directory, 'html/index.html')).href;
  if (shouldOpen) {
    try {
      await open(reportURL);
    } catch {
      console.warn(`Could not open the browser. Open the report manually: ${reportURL}`);
    }
  }
  return reportURL;
}

export { toIstanbul, writeTeamReport };
