import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

import { includeSplitSuites, runBenchmark } from './jest-benchmark.mts';

function project(t: TestContext, behavior = '', selected = ['example.test.ts'], discoveryBehavior = '') {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'grafana-jest-runner-test-'));
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const packageDir = path.join(rootDir, 'node_modules/jest');
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(path.join(rootDir, 'package.json'), '{}');
  writeFileSync(path.join(rootDir, 'jest.config.js'), 'module.exports = {};\n');
  for (const file of selected) {
    mkdirSync(path.dirname(path.join(rootDir, file)), { recursive: true });
    writeFileSync(path.join(rootDir, file), '');
  }
  writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ exports: { './bin/jest': './jest.cjs' } }));
  writeFileSync(
    path.join(packageDir, 'jest.cjs'),
    `const fs = require('node:fs');
const args = process.argv.slice(2);
const cache = args[args.indexOf('--cacheDirectory') + 1];
const discovery = args.includes('--listTests');
fs.writeFileSync(discovery ? 'discovery.json' : 'invocation.json', JSON.stringify({
  args, cache, cacheContents: fs.readdirSync(cache), cwd: process.cwd(), ci: process.env.CI, pid: process.pid,
}));
fs.writeFileSync(cache + '/transform-cache', 'populated during this invocation');
if (discovery) {
  ${discoveryBehavior}
  console.log(JSON.stringify(${JSON.stringify(selected.map((file) => path.join(rootDir, file)))}));
} else {
  ${behavior}
}
`
  );
  return rootDir;
}

function invocation(rootDir: string, phase = 'invocation') {
  return JSON.parse(readFileSync(path.join(rootDir, `${phase}.json`), 'utf8')) as {
    args: string[];
    cache: string;
    cacheContents: string[];
    cwd: string;
    ci: string;
    pid: number;
  };
}

test('uses the root Jest configuration, jsdom, shard 5/8, and four workers', async (t) => {
  const rootDir = project(t);
  assert.equal(await runBenchmark({ rootDir }), 0);
  const recorded = invocation(rootDir);
  assert.deepEqual(recorded.args, [
    '--config',
    path.join(rootDir, 'jest.config.js'),
    '--env=jsdom',
    '--ci',
    '--watch=false',
    '--watchAll=false',
    '--maxWorkers=4',
    '--cacheDirectory',
    recorded.cache,
    '--runTestsByPath',
    path.join(rootDir, 'example.test.ts'),
  ]);
  const discovery = invocation(rootDir, 'discovery');
  assert.deepEqual(discovery.args, [
    '--config',
    path.join(rootDir, 'jest.config.js'),
    '--env=jsdom',
    '--ci',
    '--watch=false',
    '--watchAll=false',
    '--maxWorkers=4',
    '--cacheDirectory',
    discovery.cache,
    '--shard=5/8',
    '--listTests',
    '--json',
  ]);
  assert.notEqual(recorded.cache, discovery.cache);
  assert.equal(existsSync(discovery.cache), false);
  assert.equal(recorded.cwd, realpathSync(rootDir));
  assert.equal(recorded.ci, 'true');
  assert.deepEqual(recorded.cacheContents, []);
  assert.equal(existsSync(recorded.cache), false);
});

test('each invocation gets an empty cache without clearing other cache directories', async (t) => {
  const rootDir = project(t);
  const existingCache = path.join(rootDir, 'node_modules/.cache');
  mkdirSync(existingCache);
  writeFileSync(path.join(existingCache, 'keep'), 'existing cache');
  assert.equal(await runBenchmark({ rootDir }), 0);
  const first = invocation(rootDir);
  assert.equal(await runBenchmark({ rootDir }), 0);
  const second = invocation(rootDir);
  assert.notEqual(first.cache, second.cache);
  assert.deepEqual(second.cacheContents, []);
  assert.equal(existsSync(first.cache), false);
  assert.equal(existsSync(second.cache), false);
  assert.equal(readFileSync(path.join(existingCache, 'keep'), 'utf8'), 'existing cache');
});

test('preserves Jest failures and removes the invocation cache', async (t) => {
  const rootDir = project(t, 'process.exitCode = 7;');
  assert.equal(await runBenchmark({ rootDir }), 7);
  assert.equal(existsSync(invocation(rootDir).cache), false);
});

test('passes listTests without changing the shard and environment', async (t) => {
  const rootDir = project(t);
  assert.equal(await runBenchmark({ rootDir, listTests: true }), 0);
  const recorded = invocation(rootDir, 'discovery');
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
  assert.ok(recorded.args.includes('--listTests'));
  assert.ok(recorded.args.includes('--shard=5/8'));
  assert.ok(recorded.args.includes('--env=jsdom'));
  assert.equal(existsSync(recorded.cache), false);
});

test('execution includes companions without applying sharding a second time', async (t) => {
  const original = 'public/swagger/schemaAnnotations.test.ts';
  const companion = 'public/swagger/schemaAnnotations.jsdom.test.ts';
  const rootDir = project(t, '', [original]);
  writeFileSync(path.join(rootDir, companion), '');
  assert.equal(await runBenchmark({ rootDir }), 0);
  const args = invocation(rootDir).args;
  assert.equal(args.some((arg) => arg.startsWith('--shard')), false);
  assert.deepEqual(args.slice(args.indexOf('--runTestsByPath') + 1), [
    path.join(rootDir, companion),
    path.join(rootDir, original),
  ]);
});

const splitPairs = [
  ['public/app/features/inspector/utils/download.test.ts', 'public/app/features/inspector/utils/download.jsdom.test.ts'],
  ['public/app/plugins/panel/annolist/AnnoListPanel.test.tsx', 'public/app/plugins/panel/annolist/AnnoListPanel.jsdom.test.tsx'],
  ['public/swagger/schemaAnnotations.test.ts', 'public/swagger/schemaAnnotations.jsdom.test.ts'],
];
for (const pair of splitPairs) {
  test(`selection keeps both halves of ${pair[0]} and deduplicates them`, () => {
    const rootDir = path.resolve('fixture');
    const expected = pair.map((file) => path.join(rootDir, file)).sort();
    assert.deepEqual(includeSplitSuites(rootDir, [pair[0]]), expected);
    assert.deepEqual(includeSplitSuites(rootDir, [pair[1]]), expected);
    assert.deepEqual(includeSplitSuites(rootDir, [...pair, pair[0]]), expected);
  });
}

test('selection leaves unrelated suites alone', () => {
  const rootDir = path.resolve('fixture');
  assert.deepEqual(includeSplitSuites(rootDir, ['other.test.ts']), [path.join(rootDir, 'other.test.ts')]);
});

test('discovery failures do not start execution and retain their exit code', async (t) => {
  const rootDir = project(t, '', ['example.test.ts'], 'process.exitCode = 9;');
  assert.equal(await runBenchmark({ rootDir }), 9);
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
  assert.equal(existsSync(invocation(rootDir, 'discovery').cache), false);
});

test('empty discovery results fail rather than running a misleading benchmark', async (t) => {
  const rootDir = project(t, '', []);
  await assert.rejects(runBenchmark({ rootDir }), /nonempty array of test paths/);
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
  assert.equal(existsSync(invocation(rootDir, 'discovery').cache), false);
});

test('missing companions fail rather than silently dropping extracted coverage', async (t) => {
  const rootDir = project(t, '', ['public/swagger/schemaAnnotations.test.ts']);
  await assert.rejects(runBenchmark({ rootDir }), { code: 'ENOENT' });
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
  assert.equal(existsSync(invocation(rootDir, 'discovery').cache), false);
});

test('the overall deadline stops the process and returns a failing exit code', { timeout: 10000 }, async (t) => {
  const rootDir = project(t, 'setInterval(() => {}, 1000);');
  assert.equal(await runBenchmark({ rootDir, timeoutMs: 1000 }), 124);
  assert.equal(existsSync(invocation(rootDir).cache), false);
});

function runSubprocess(rootDir: string) {
  const runner = new URL('./jest-benchmark.mts', import.meta.url).href;
  try {
    return spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { runBenchmark } from ${JSON.stringify(runner)};
process.exitCode = await runBenchmark({ rootDir: ${JSON.stringify(rootDir)} });`,
      ],
      { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' }
    );
  } finally {
    if (existsSync(path.join(rootDir, 'invocation.json'))) {
      try {
        process.kill(-invocation(rootDir).pid, 'SIGKILL');
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) {
          throw error;
        }
      }
    }
  }
}

for (const [signal, expected] of [['SIGINT', 130], ['SIGTERM', 143]] as const) {
  test(`${signal} cancels the runner and removes its cache`, { skip: process.platform === 'win32' }, (t) => {
    const rootDir = project(t, `process.kill(process.ppid, '${signal}'); setInterval(() => {}, 1000);`);
    const result = runSubprocess(rootDir);
    assert.equal(result.error, undefined);
    assert.equal(result.status, expected);
    assert.equal(existsSync(invocation(rootDir).cache), false);
  });
}

test(
  'cancellation reaches workers and escalates when the coordinator ignores SIGTERM',
  { skip: process.platform === 'win32', timeout: 15000 },
  (t) => {
    const worker = `const fs = require('node:fs');
process.on('SIGTERM', () => { fs.writeFileSync('worker-stopped', 'SIGTERM'); process.exit(0); });
process.send('ready');
setInterval(() => {}, 1000);`;
    const rootDir = project(t, `
process.on('SIGTERM', () => {});
const worker = require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(worker)}], {
  stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
});
worker.on('message', () => process.kill(process.ppid, 'SIGTERM'));
setInterval(() => {}, 1000);`);
    const result = runSubprocess(rootDir);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 143);
    assert.equal(readFileSync(path.join(rootDir, 'worker-stopped'), 'utf8'), 'SIGTERM');
    assert.equal(existsSync(invocation(rootDir).cache), false);
  }
);

test('rejects unknown CLI options before starting a run', () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./jest-benchmark.mts', import.meta.url)), '--workers=1'],
    { encoding: 'utf8', timeout: 10000 }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option '--workers'/);
  assert.doesNotMatch(result.stdout, /cold Jest cache/);
});
