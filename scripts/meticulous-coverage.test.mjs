import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { fetchCoverage, parseCoveragePage, renderReport, runCli } from './meticulous-coverage-by-codeowner.mjs';
import { writeTeamReport } from './meticulous-coverage-report.mjs';

const header = 'repoFilePath\texecutedLines\texecutableLines';

test('skips invalid rows and continues pagination using raw row counts', async () => {
  const offsets = [];
  const coverage = await fetchCoverage(undefined, async (args) => {
    if (args.includes('--summary')) {
      return JSON.stringify({ testRunId: 'run', filesFailedToParse: 2 });
    }
    const offset = args.find((arg) => arg.startsWith('--offset='));
    offsets.push(offset);
    return offset === '--offset=0'
      ? [header, ...Array.from({ length: 999 }, (_, i) => `public/app/file${i}.ts\t1\t2`), 'bad\t3\t2'].join('\n')
      : `${header}\npublic/app/last.ts\t1\t1`;
  });
  assert.deepEqual(offsets, ['--offset=0', '--offset=1000']);
  assert.equal(coverage.files.length, 1000);
  assert.equal(coverage.skippedRows, 1);
  const report = renderReport(coverage, {});
  assert.match(report, /could not parse 2 files/);
  assert.match(report, /Skipped 1 invalid coverage rows/);
});

test('skips invalid paths and ranges while rejecting invalid headers', () => {
  const page = parseCoveragePage(
    `${header}\texecutedRanges\texecutableRanges\n../bad.ts\t1\t1\t1\t1\npublic/app/bad.ts\t1\t1\tbad\t1\npublic/app/good.ts\t1\t1\t1\t1`,
    true
  );
  assert.equal(page.skippedRows, 2);
  assert.equal(page.files.length, 1);
  assert.throws(() => parseCoveragePage('invalid'), /Invalid Meticulous coverage columns/);
});

test('HTML report lists mismatched files and retains valid files, including when all files are skipped', async () => {
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));
  const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const directory = await mkdtemp(path.join(os.tmpdir(), 'meticulous-report-'));
  const good = {
    path: 'scripts/meticulous-coverage-report.mjs',
    executedLines: 1,
    executableLines: 1,
    executedRanges: [[1, 1]],
    executableRanges: [[1, 1]],
  };
  const bad = { ...good, path: 'scripts/meticulous-coverage-by-codeowner.mjs', executableLines: 2 };
  const pastEnd = {
    ...good,
    path: 'scripts/codeowners-manifest/coverage-files.js',
    executedRanges: [[99999, 99999]],
    executableRanges: [[99999, 99999]],
  };
  try {
    for (const [index, files] of [[good, bad, pastEnd], [bad]].entries()) {
      const result = await writeTeamReport(
        { source: { commitSha, testRunId: 'run' }, files, skippedRows: 3 },
        '@grafana/test',
        { repoRoot, outputDir: path.join(directory, String(index)) }
      );
      assert.deepEqual(result.files, index === 0 ? [good] : []);
      assert.equal(result.skippedFiles.length, index === 0 ? 2 : 1);
      const terminal = renderReport(
        { source: { testRunId: 'run' }, files: result.files },
        { [good.path]: ['@grafana/test'] },
        '@grafana/test'
      );
      assert.match(terminal, index === 0 ? /100.00%/ : /No coverage data/);
      const html = await readFile(fileURLToPath(result.reportURL), 'utf8');
      assert.match(html, /Skipped 3 invalid coverage rows/);
      assert.match(html, /Coverage ranges and line counts disagree/);
      assert.match(html, /report totals exclude these files/);
      if (index === 0) {
        assert.match(html, /Coverage ranges do not match/);
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Windows uses a shell for npm shims and rejects shell metacharacters', async () => {
  const calls = [];
  const execute = async (...args) => {
    calls.push(args);
    return { stdout: 'coverage' };
  };
  assert.equal(await runCli(['--testRunId=run-123'], {}, 'win32', execute), 'coverage');
  assert.equal(calls[0][2].shell, true);
  for (const id of ['run&whoami', 'run%PATH%', 'run\"', 'run\nwhoami', 'run|whoami']) {
    await assert.rejects(runCli([`--testRunId=${id}`], {}, 'win32', execute), /Invalid Meticulous CLI argument/);
  }
  assert.equal(calls.length, 1);
  await runCli(['--version'], {}, 'linux', execute);
  assert.equal(calls[1][2].shell, false);
});

test('empty output ends pagination after full pages and for an empty dataset', async () => {
  for (const count of [0, 1000, 2000]) {
    for (const emptyPage of ['', '\r\n', header]) {
      const offsets = [];
      const coverage = await fetchCoverage(undefined, async (args) => {
        if (args.includes('--summary')) {
          return JSON.stringify({ testRunId: 'run' });
        }
        const offset = Number(args.find((arg) => arg.startsWith('--offset=')).split('=')[1]);
        offsets.push(offset);
        if (offset === count) {
          return emptyPage;
        }
        return [header, ...Array.from({ length: 1000 }, (_, i) => `public/app/file${offset + i}.ts\t1\t2`)].join('\n');
      });
      assert.deepEqual(
        offsets,
        Array.from({ length: count / 1000 + 1 }, (_, i) => i * 1000)
      );
      assert.equal(coverage.files.length, count);
      assert.equal(coverage.skippedRows, 0);
    }
  }
});

test('nonempty malformed pages remain errors after a full page', async () => {
  await assert.rejects(
    fetchCoverage(undefined, async (args) => {
      if (args.includes('--summary')) {
        return JSON.stringify({ testRunId: 'run' });
      }
      return args.includes('--offset=0')
        ? [header, ...Array.from({ length: 1000 }, (_, i) => `public/app/file${i}.ts\t1\t2`)].join('\n')
        : 'invalid';
    }),
    /Invalid Meticulous coverage columns/
  );
});
