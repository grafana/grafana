const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const v8 = require('node:v8');

function createMeter(clock = () => Number(process.hrtime.bigint()) / 1e6) {
  const origin = clock();
  let previous = origin;
  let phase = 'startup';
  const stack = [];
  const rows = new Map();
  const phases = {};
  const traceEvents = [];
  const events = [];
  const modules = {};
  const now = () => clock() - origin;
  const account = () => {
    const time = clock();
    const category = stack.at(-1)?.category ?? 'other';
    const buckets = phases[phase] ??= {};
    buckets[category] = (buckets[category] ?? 0) + time - previous;
    previous = time;
  };
  const span = (name, category, start, end, args = {}) => {
    traceEvents.push({ name, cat: category, ph: 'X', ts: start * 1000, dur: (end - start) * 1000, pid: process.pid, tid: 1, args });
  };
  const measure = (category, label, fn, timeline = true) => {
    account();
    const start = now();
    const frame = { category, children: 0 };
    stack.push(frame);
    try {
      return fn();
    } finally {
      const elapsed = now() - start;
      account();
      stack.pop();
      if (stack.length) stack.at(-1).children += elapsed;
      const key = `${category}\0${label}`;
      const row = rows.get(key) ?? { category, label, calls: 0, inclusiveMs: 0, selfMs: 0 };
      row.calls++;
      row.inclusiveMs += elapsed;
      row.selfMs += elapsed - frame.children;
      rows.set(key, row);
      if (timeline) span(label, category, start, start + elapsed);
    }
  };
  const setPhase = (value) => {
    account();
    phase = value;
  };
  const mark = (name, details = {}) => {
    const event = { name, time: now(), ...details };
    events.push(event);
    traceEvents.push({ name, cat: 'lifecycle', ph: 'i', s: 't', ts: event.time * 1000, pid: process.pid, tid: 1, args: details });
  };
  const snapshot = () => {
    account();
    return { clockOriginUs: origin * 1000, elapsedMs: now(), phases, rows: [...rows.values()], modules, events, traceEvents };
  };
  return { now, measure, setPhase, mark, span, snapshot, modules };
}

module.exports = { createMeter };

if (process.env.GRAFANA_JEST_PROFILE_RUN) {
  const meter = createMeter();
  module.exports.meter = meter;
  const root = process.env.GRAFANA_JEST_PROFILE_ROOT;
  const run = process.env.GRAFANA_JEST_PROFILE_RUN;
  const rootRequire = createRequire(path.join(root, 'package.json'));
  // Follow declared dependency edges so this also works with pnpm's strict layout.
  const jestRequire = createRequire(rootRequire.resolve('jest'));
  const coreRequire = createRequire(jestRequire.resolve('@jest/core'));
  const runnerRequire = createRequire(coreRequire.resolve('jest-runner'));
  const runtimeRequire = createRequire(runnerRequire.resolve('jest-runtime'));
  const version = rootRequire('jest/package.json').version;
  if (!version.startsWith('29.')) throw new Error(`The profiler supports Jest 29 internals, not ${version}.`);
  const label = (file) => typeof file === 'string' ? path.relative(root, file).split(path.sep).join('/') : '<unknown>';
  const wrap = (object, name, category, filename, timeline = true) => {
    const original = object[name];
    if (typeof original !== 'function') throw new Error(`Missing Jest profiling hook: ${name}`);
    object[name] = function (...args) {
      return meter.measure(category, filename(args), () => original.apply(this, args), timeline);
    };
  };

  const transformModule = runtimeRequire(path.join(path.dirname(runtimeRequire.resolve('@jest/transform')), 'ScriptTransformer.js'));
  const createTransformer = transformModule.createScriptTransformer;
  if (typeof createTransformer !== 'function') throw new Error('Missing Jest createScriptTransformer hook');
  const instrumented = new WeakSet();
  transformModule.createScriptTransformer = async function (...args) {
    const scriptTransformer = await createTransformer.apply(this, args);
    const getTransformer = scriptTransformer._getTransformer;
    if (typeof getTransformer !== 'function') throw new Error('Missing Jest _getTransformer hook');
    scriptTransformer._getTransformer = function (...args) {
      const result = getTransformer.apply(this, args);
      const transformer = result?.transformer;
      if (transformer && !instrumented.has(transformer)) {
        instrumented.add(transformer);
        for (const [method, category] of [['process', 'transformer process'], ['getCacheKey', 'transformer cache key']]) {
          if (typeof transformer[method] === 'function') wrap(transformer, method, category, (args) => label(args[1]));
        }
      }
      return result;
    };
    wrap(scriptTransformer, 'transformSource', 'transform pipeline', (args) => label(args[0]));
    // Async ESM transformation needs a different accounting model than this synchronous CJS stack.
    scriptTransformer.transformSourceAsync = () => { throw new Error('The profiler supports synchronous CJS transformation only.'); };
    return scriptTransformer;
  };

  const Runtime = runtimeRequire('jest-runtime').default;
  const moduleStack = [];
  const exec = Runtime.prototype._execModule;
  if (typeof exec !== 'function') throw new Error('Missing Jest _execModule hook');
  Runtime.prototype._execModule = function (module, ...args) {
    const file = label(module.filename);
    if (module.filename === process.env.GRAFANA_JEST_PROFILE_SUITE) meter.setPhase('suite imports/collection');
    const row = meter.modules[file] ??= { executions: 0, firstParent: moduleStack.at(-1) ?? '<Jest>', firstStartMs: meter.now() };
    row.executions++;
    moduleStack.push(file);
    try {
      return meter.measure('module execution/loading', file, () => exec.call(this, module, ...args));
    } finally {
      moduleStack.pop();
    }
  };
  wrap(Runtime.prototype, 'transformFile', 'transform pipeline', (args) => label(args[0]));
  wrap(Runtime.prototype, 'createScriptFromCode', 'V8 script creation', (args) => label(args[1]));
  wrap(Runtime.prototype, '_resolveCjsModule', 'resolution', (args) => `${label(args[0])} -> ${args[1]}`, false);
  wrap(Runtime.prototype, '_generateMock', 'automatic mock generation', (args) => `${label(args[0])} -> ${args[1]}`);
  const reset = Runtime.prototype.resetModules;
  Runtime.prototype.resetModules = function (...args) {
    meter.mark('resetModules');
    return reset.apply(this, args);
  };
  const Resolver = runtimeRequire('jest-resolve').default;
  wrap(Resolver.prototype, 'resolveModule', 'resolution', (args) => `${label(args[0])} -> ${args[1]}`, false);

  meter.mark('instrumentation ready', { node: process.version, jest: version, heapLimitBytes: v8.getHeapStatistics().heap_size_limit });
  process.on('exit', (exitCode) => {
    const snapshot = meter.snapshot();
    const { traceEvents, ...data } = snapshot;
    fs.writeFileSync(`${run}.trace.json`, JSON.stringify({ traceEvents, displayTimeUnit: 'ms' }));
    fs.writeFileSync(`${run}.attribution.json`, JSON.stringify({
      ...data, exitCode, pid: process.pid, node: process.version, jest: version,
      cpu: process.cpuUsage(), resources: process.resourceUsage(), memory: process.memoryUsage(),
    }));
  });
}
