const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { createMeter } = require('./instrument.cjs');
const { summarize, summarizeCpu } = require('./report.cjs');
const { runChild, positiveInteger } = require('../jest-profile.cjs');
const { resolveTransform } = require('./swc-config.cjs');

test('attributes nested loader, pipeline, and transformer time without double counting', () => {
  let time = 0;
  const meter = createMeter(() => time);
  time = 2;
  meter.measure('module', 'suite.ts', () => {
    time += 3;
    meter.measure('pipeline', 'suite.ts', () => {
      time += 5;
      meter.measure('transformer', 'suite.ts', () => { time += 7; });
      time += 11;
    });
    time += 13;
  });
  time += 17;
  const data = meter.snapshot();
  assert.equal(data.elapsedMs, 58);
  assert.deepEqual(data.phases.startup, { other: 19, module: 16, pipeline: 16, transformer: 7 });
  assert.deepEqual(data.rows.find((row) => row.category === 'module'), {
    category: 'module', label: 'suite.ts', calls: 1, inclusiveMs: 39, selfMs: 16,
  });
  assert.equal(data.traceEvents.find((event) => event.name === 'suite.ts' && event.cat === 'transformer').dur, 7000);
});

test('splits a measured operation across lifecycle phases', () => {
  let time = 0;
  const meter = createMeter(() => time);
  meter.measure('module', 'suite.ts', () => {
    time += 4;
    meter.setPhase('test bodies');
    time += 6;
  });
  assert.deepEqual(meter.snapshot().phases, { startup: { other: 0, module: 4 }, 'test bodies': { module: 6, other: 0 } });
});

test('unwinds attribution after an exception and aggregates repeated execution', () => {
  let time = 0;
  const meter = createMeter(() => time);
  assert.throws(() => meter.measure('module', 'a.ts', () => { time += 3; throw new Error('failure'); }), /failure/);
  meter.measure('module', 'a.ts', () => { time += 5; });
  time += 2;
  const data = meter.snapshot();
  assert.equal(data.rows[0].calls, 2);
  assert.equal(data.rows[0].selfMs, 8);
  assert.deepEqual(data.phases.startup, { other: 2, module: 8 });
});

test('separates module repeats from actual transformer invocations', () => {
  const summary = summarize({
    phases: { startup: { 'transformer process': 10, other: 5 }, 'test bodies': { other: 3 } },
    modules: { 'a.ts': { executions: 2 }, 'node_modules/b.js': { executions: 1 } },
    rows: [{ category: 'transformer process', label: 'a.ts', calls: 1 }, { category: 'transformer process', label: 'node_modules/b.js', calls: 1 }],
    events: [{ name: 'run_start', time: 15 }, { name: 'test body result', assertions: 2 }, { name: 'run_finish', time: 18 }],
  });
  assert.deepEqual(summary.categories, { 'transformer process': 10, other: 8 });
  assert.equal(summary.uniqueModules, 2);
  assert.equal(summary.moduleExecutions, 3);
  assert.equal(summary.transformProcessCalls, 2);
  assert.equal(summary.transformedDependencyFiles, 1);
  assert.equal(summary.beforeTestsMs, 15);
  assert.equal(summary.testsAndHooksMs, 3);
  assert.equal(summary.matcherCalls, 2);
  assert.equal(summary.complete, true);
});

test('aligns CPU samples to the lifecycle clock and attributes self time once', () => {
  const summary = summarizeCpu({
    startTime: 100000,
    nodes: [
      { id: 1, callFrame: { functionName: 'compile', url: 'compiler.js', lineNumber: 9 } },
      { id: 2, callFrame: { functionName: 'render', url: 'component.js', lineNumber: 19 } },
    ],
    samples: [1, 2, 2], timeDeltas: [2000, 4000, 4000],
  }, { clockOriginUs: 100000, events: [{ name: 'run_start', time: 5 }, { name: 'run_finish', time: 9 }] });
  assert.deepEqual(summary, {
    'startup/imports': { sampledMs: 2, topSelf: [{ frame: 'compile (compiler.js:10)', ms: 2 }] },
    'tests/hooks': { sampledMs: 4, topSelf: [{ frame: 'render (component.js:20)', ms: 4 }] },
    'teardown/report': { sampledMs: 4, topSelf: [{ frame: 'render (component.js:20)', ms: 4 }] },
  });
});

test('marks an aborted collection as incomplete', () => {
  assert.equal(summarize({ phases: {}, modules: {}, rows: [], events: [] }).complete, false);
});

test('rejects malformed limits', () => {
  for (const value of ['0', '-1', '1.5', '1e3', 'Infinity', '9007199254740992']) {
    assert.throws(() => positiveInteger(value, 'limit'), /positive integer/);
  }
  assert.equal(positiveInteger('768', 'limit'), 768);
});

test('keeps the root transform configuration unless an alternative is explicitly selected', () => {
  assert.deepEqual(resolveTransform(__dirname, 'ts-jest'), { overrides: {}, metadata: { name: 'ts-jest' } });
  assert.throws(() => resolveTransform(__dirname, 'babel'), /--transformer must be ts-jest, swc, swc-mutable, or sucrase/);
    assert.throws(() => resolveTransform(__dirname, 'swc', undefined, 'adapter'), /--sucrase-jest requires --transformer=sucrase/);
    assert.throws(() => resolveTransform(__dirname, 'sucrase', 'adapter'), /--swc-jest requires/);
  assert.throws(() => resolveTransform(__dirname, 'ts-jest', 'adapter'), /--swc-jest requires --transformer=swc/);
});

test('reports a missing optional SWC adapter without falling back to another transformer', (t) => {
  const root = path.dirname(logPath(t));
  assert.throws(() => resolveTransform(root, 'swc', './missing-adapter'), /Cannot resolve @swc\/jest/);
});

test('resolves an isolated SWC adapter and assigns the correct parser to each extension', (t) => {
  const root = path.dirname(logPath(t));
  const adapter = path.join(root, 'node_modules/@swc/jest');
  const core = path.join(root, 'node_modules/@swc/core');
  fs.mkdirSync(adapter, { recursive: true });
  fs.mkdirSync(core, { recursive: true });
  fs.writeFileSync(path.join(adapter, 'index.js'), 'throw new Error("Configuration must not load the transformer");');
  fs.writeFileSync(path.join(adapter, 'package.json'), JSON.stringify({ version: '0.2.38', main: 'index.js' }));
  fs.writeFileSync(path.join(core, 'package.json'), JSON.stringify({ version: '1.13.3' }));
  const result = resolveTransform(root, 'swc', './node_modules/@swc/jest');
  assert.deepEqual(result, resolveTransform(root, 'swc'));
  assert.deepEqual(result.metadata, {
    name: 'swc', adapter: path.join(adapter, 'index.js'), jestAdapterVersion: '0.2.38', coreVersion: '1.13.3',
  });
  assert.deepEqual(Object.keys(result.overrides), ['transform']);
  const entries = Object.entries(result.overrides.transform);
  for (const [filename, parser] of [
    ['module.ts', { syntax: 'typescript', tsx: false, decorators: true }],
    ['component.tsx', { syntax: 'typescript', tsx: true, decorators: true }],
    ['module.js', { syntax: 'ecmascript', jsx: true, decorators: true }],
    ['component.jsx', { syntax: 'ecmascript', jsx: true, decorators: true }],
  ]) {
    const matches = entries.filter(([pattern]) => new RegExp(pattern).test(filename));
    assert.equal(matches.length, 1, filename);
    const [resolved, options] = matches[0][1];
    assert.equal(resolved, result.metadata.adapter);
    assert.deepEqual(options, {
      swcrc: false, configFile: false, sourceMaps: true, module: { type: 'commonjs' },
      jsc: {
        target: 'es2018', parser,
        transform: {
          legacyDecorator: true, useDefineForClassFields: false,
          react: { runtime: 'automatic', development: false },
        },
      },
    });
  }
  assert.equal(entries.some(([pattern]) => new RegExp(pattern).test('data.json')), false);

  const plugin = path.join(root, 'node_modules/@swc-contrib/mut-cjs-exports');
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(path.join(plugin, 'plugin.wasm'), 'fixture');
  fs.writeFileSync(path.join(plugin, 'package.json'), JSON.stringify({ version: '11.0.2', main: 'plugin.wasm' }));
  const mutable = resolveTransform(root, 'swc-mutable');
  assert.equal(mutable.metadata.name, 'swc-mutable');
  assert.equal(mutable.metadata.pluginVersion, '11.0.2');
  assert.equal(mutable.metadata.plugin, path.join(plugin, 'plugin.wasm'));
  for (const [pattern, [, options]] of Object.entries(mutable.overrides.transform)) {
    const { experimental, ...jsc } = options.jsc;
    assert.deepEqual(experimental, { plugins: [[mutable.metadata.plugin, {}]] });
    assert.deepEqual({ ...options, jsc }, result.overrides.transform[pattern][1]);
  }
  assert.deepEqual(resolveTransform(root, 'swc'), result);
});

test('rejects mutable SWC when the adapter cannot resolve its optional plugin', (t) => {
  const root = path.dirname(logPath(t));
  const adapter = path.join(root, 'node_modules/@swc/jest');
  fs.mkdirSync(adapter, { recursive: true });
  fs.writeFileSync(path.join(adapter, 'index.js'), '');
  assert.throws(() => resolveTransform(root, 'swc-mutable'), /Cannot resolve @swc-contrib\/mut-cjs-exports/);
});

test('resolves a Sucrase adapter with automatic JSX, assignment-style class fields, and CJS dynamic imports', (t) => {
  const root = path.dirname(logPath(t));
  assert.throws(() => resolveTransform(root, 'sucrase', undefined, './missing'), /Cannot resolve @sucrase\/jest-plugin/);
  const adapter = path.join(root, 'node_modules/@sucrase/jest-plugin');
  const core = path.join(root, 'node_modules/sucrase');
  fs.mkdirSync(path.join(adapter, 'dist'), { recursive: true });
  fs.mkdirSync(core, { recursive: true });
  fs.writeFileSync(path.join(adapter, 'dist/index.js'), 'throw new Error("Configuration must not load the transformer");');
  fs.writeFileSync(path.join(adapter, 'package.json'), JSON.stringify({ version: '3.0.0', main: 'dist/index.js' }));
  fs.writeFileSync(path.join(core, 'package.json'), JSON.stringify({ version: '3.35.1' }));
  const result = resolveTransform(root, 'sucrase', undefined, './node_modules/@sucrase/jest-plugin');
  assert.deepEqual(result, resolveTransform(root, 'sucrase'));
  assert.deepEqual(result.metadata, {
    name: 'sucrase', adapter: path.join(adapter, 'dist/index.js'), jestAdapterVersion: '3.0.0', coreVersion: '3.35.1',
  });
  assert.deepEqual(result.overrides, {
    transform: {
      '^.+\\.(ts|tsx|js|jsx)$': [result.metadata.adapter, {
        jsxRuntime: 'automatic', production: true, disableESTransforms: false, preserveDynamicImport: false,
      }],
    },
  });
});

function logPath(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jest-profile-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return path.join(directory, 'child.log');
}

test('preserves a failing child exit and console output', async (t) => {
  const log = logPath(t);
  const result = await runChild(process.execPath, ['-e', 'console.error("expected failure"); process.exitCode = 7;'], {}, log, 5000);
  assert.equal(result.code, 7);
  assert.equal(result.stopped, false);
  assert.match(fs.readFileSync(log, 'utf8'), /expected failure/);
});

test('stops a child at the deadline', async (t) => {
  const result = await runChild(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], {}, logPath(t), 100);
  assert.equal(result.code, 124);
  assert.equal(result.stopped, true);
});
