import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
  writeFileSync(path.join(rootDir, 'jest.happy-dom.config.js'), 'module.exports = {};\n');
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

for (const environment of ['jsdom', 'happy-dom'] as const) {
  test(`${environment} is passed to both discovery and execution`, async (t) => {
    const rootDir = project(t);
    assert.equal(await runBenchmark({ rootDir, environment }), 0);
    const expected = environment === 'jsdom' ? 'jsdom' : path.resolve(rootDir, 'public/test/happy-dom-environment.js');
    const config = environment === 'happy-dom' ? 'jest.happy-dom.config.js' : 'jest.config.js';
    for (const phase of ['discovery', 'invocation']) {
      const { args } = invocation(rootDir, phase);
      assert.deepEqual(args.filter((arg) => arg.startsWith('--env=')), [`--env=${expected}`]);
      assert.equal(args[args.indexOf('--config') + 1], path.join(rootDir, config));
    }
  });
}

function runCli(rootDir: string, args: string[]) {
  const scriptsDir = path.join(rootDir, 'scripts');
  mkdirSync(scriptsDir, { recursive: true });
  const runner = path.join(scriptsDir, 'jest-benchmark.mts');
  copyFileSync(fileURLToPath(new URL('./jest-benchmark.mts', import.meta.url)), runner);
  return spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8', timeout: 10000 });
}

for (const environment of [undefined, 'jsdom', 'happy-dom']) {
  test(`CLI selects ${environment ?? 'jsdom by default'} for discovery and execution`, (t) => {
    const rootDir = project(t);
    const result = runCli(rootDir, environment === undefined ? [] : [`--environment=${environment}`]);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    const expected = environment === 'happy-dom' ? path.resolve(rootDir, 'public/test/happy-dom-environment.js') : 'jsdom';
    for (const phase of ['discovery', 'invocation']) {
      assert.deepEqual(invocation(rootDir, phase).args.filter((arg) => arg.startsWith('--env=')), [`--env=${expected}`]);
    }
    assert.ok(result.stdout.startsWith(`${environment ?? 'jsdom'} | shard 5/8 + split companions |`));
    assert.ok(invocation(rootDir, 'discovery').args.includes('--shard=5/8'));
  });
}

for (const shard of ['1/8', '5/8']) {
  test(`Happy DOM CLI shard ${shard} selects its Sucrase configuration`, (t) => {
    const rootDir = project(t);
    const result = runCli(rootDir, ['--environment=happy-dom', `--shard=${shard}`]);
    assert.equal(result.status, 0, result.stderr);
    for (const phase of ['discovery', 'invocation']) {
      const { args } = invocation(rootDir, phase);
      assert.equal(args[args.indexOf('--config') + 1], path.join(rootDir, 'jest.happy-dom.config.js'));
      assert.ok(args.includes('--maxWorkers=4'));
    }
    assert.ok(invocation(rootDir, 'discovery').args.includes(`--shard=${shard}`));
    assert.equal(invocation(rootDir).args.some((arg) => arg.startsWith('--shard')), false);
  });
}

for (const shard of ['1/1', '1/8', '8/8', '2/3']) {
  test(`shard ${shard} applies only to discovery`, async (t) => {
    const rootDir = project(t);
    assert.equal(await runBenchmark({ rootDir, shard }), 0);
    assert.deepEqual(invocation(rootDir, 'discovery').args.filter((arg) => arg.startsWith('--shard')), [`--shard=${shard}`]);
    assert.equal(invocation(rootDir).args.some((arg) => arg.startsWith('--shard')), false);
    assert.equal(existsSync(invocation(rootDir, 'discovery').cache), false);
    assert.equal(existsSync(invocation(rootDir).cache), false);
  });
}

for (const environment of ['jsdom', 'happy-dom']) {
  for (const listTests of [false, true]) {
    test(`CLI shard selection preserves split companions for ${environment}, listTests=${listTests}`, (t) => {
      const original = 'public/swagger/schemaAnnotations.test.ts';
      const companion = 'public/swagger/schemaAnnotations.jsdom.test.ts';
      const rootDir = project(t, '', [original]);
      writeFileSync(path.join(rootDir, companion), '');
      const result = runCli(rootDir, [`--environment=${environment}`, '--shard=2/3', ...(listTests ? ['--listTests'] : [])]);
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.stdout.startsWith(`${environment} | shard 2/3 + split companions |`));
      const discovery = invocation(rootDir, 'discovery');
      assert.deepEqual(discovery.args.filter((arg) => arg.startsWith('--shard')), ['--shard=2/3']);
      assert.ok(
        discovery.args.includes(
          environment === 'jsdom' ? '--env=jsdom' : `--env=${path.resolve(rootDir, 'public/test/happy-dom-environment.js')}`
        )
      );
      assert.match(result.stdout, /Selected 1 shard suites \+ 1 split companions\./);
      if (listTests) {
        assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
        assert.ok(result.stdout.endsWith(`${companion}\n${original}\n`));
      } else {
        const args = invocation(rootDir).args;
        assert.equal(args.some((arg) => arg.startsWith('--shard')), false);
        assert.deepEqual(args.slice(args.indexOf('--runTestsByPath') + 1), [
          path.join(rootDir, companion),
          path.join(rootDir, original),
        ]);
      }
    });
  }
}

test('invalid shards are rejected before Jest resolution or startup', async (t) => {
  const rootDir = project(t);
  rmSync(path.join(rootDir, 'node_modules'), { recursive: true });
  const log = t.mock.method(console, 'log', () => {});
  for (const shard of [
    '',
    '1',
    '0/8',
    '1/0',
    '9/8',
    '-1/8',
    '1/-8',
    '1.5/8',
    '1/2.5',
    '1e0/8',
    '1/8/9',
    'one/8',
    ' 1/8',
    '1/8 ',
    '1/8\n',
    '01/8',
    '1/08',
    '1/9007199254740992',
    '9007199254740992/9007199254740992',
  ]) {
    await assert.rejects(runBenchmark({ rootDir, shard }), /Invalid shard.*Expected N\/M/);
    const result = runCli(rootDir, [`--shard=${shard}`]);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid shard.*Expected N\/M/);
    assert.equal(result.stdout, '');
  }
  assert.equal(log.mock.callCount(), 0);
  assert.equal(existsSync(path.join(rootDir, 'discovery.json')), false);
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
});

test('invalid environments are rejected before Jest resolution or startup', async (t) => {
  const rootDir = project(t);
  rmSync(path.join(rootDir, 'node_modules'), { recursive: true });
  const log = t.mock.method(console, 'log', () => {});
  for (const environment of ['', 'node', 'Happy-dom']) {
    // @ts-expect-error Invalid environments must also be rejected at runtime.
    await assert.rejects(runBenchmark({ rootDir, environment }), /Invalid environment.*Expected jsdom or happy-dom/);
    const result = runCli(rootDir, [`--environment=${environment}`]);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid environment.*Expected jsdom or happy-dom/);
    assert.equal(result.stdout, '');
  }
  assert.equal(log.mock.callCount(), 0);
  assert.equal(existsSync(path.join(rootDir, 'discovery.json')), false);
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
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

test('environments produce identical expanded paths, list output, and selection hashes', async (t) => {
  const selected = ['other.test.ts', ...splitPairs.map((pair) => pair[0])];
  const rootDir = project(t, '', selected);
  for (const pair of splitPairs) {
    writeFileSync(path.join(rootDir, pair[1]), '/** @jest-environment jsdom */\n');
  }
  const expected = includeSplitSuites(rootDir, selected);
  const log = t.mock.method(console, 'log', () => {});
  const hashes: string[] = [];
  for (const environment of ['jsdom', 'happy-dom'] as const) {
    for (const listTests of [false, true]) {
      log.mock.resetCalls();
      if (listTests) {
        rmSync(path.join(rootDir, 'invocation.json'));
      }
      assert.equal(await runBenchmark({ rootDir, environment, listTests }), 0);
      if (!listTests) {
        const args = invocation(rootDir).args;
        assert.deepEqual(args.slice(args.indexOf('--runTestsByPath') + 1), expected);
        assert.equal(args.some((arg) => arg.startsWith('--shard')), false);
      }
      const output = log.mock.calls.map((call) => call.arguments[0]);
      const hash = output.find((line) => line.startsWith('Selection SHA-256:'));
      assert.match(hash ?? '', /^Selection SHA-256: [a-f0-9]{64}$/);
      hashes.push(hash!);
      if (listTests) {
        assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
        assert.equal(
          output.at(-1),
          expected.map((file) => path.relative(rootDir, file).split(path.sep).join('/')).join('\n')
        );
      }
    }
  }
  assert.equal(new Set(hashes).size, 1);
  for (const pair of splitPairs) {
    assert.equal(readFileSync(path.join(rootDir, pair[1]), 'utf8'), '/** @jest-environment jsdom */\n');
  }
});

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
