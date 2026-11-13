const metricsDir = process.env.GRAFANA_BENCHMARK_METRICS_DIR;

if (metricsDir && require('node:worker_threads').isMainThread) {
  const { randomUUID } = require('node:crypto');
  const { writeFileSync, renameSync, unlinkSync, writeSync } = require('node:fs');
  const path = require('node:path');
  const { performance, PerformanceObserver, constants } = require('node:perf_hooks');

  const entry = path.resolve(process.argv[1] || '');
  const jestEntry = process.env.GRAFANA_BENCHMARK_JEST_ENTRY;
  const workerId = process.env.JEST_WORKER_ID ?? null;
  const role = jestEntry && entry === path.resolve(jestEntry)
    ? 'coordinator'
    : workerId !== null && entry.split(path.sep).join('/').endsWith('/jest-worker/build/workers/processChild.js')
      ? 'worker'
      : 'child';
  const filename = path.join(metricsDir, `${process.pid}-${randomUUID()}.json`);
  const temporary = `${filename}.tmp`;
  const kinds = {
    [constants.NODE_PERFORMANCE_GC_MAJOR]: 'major',
    [constants.NODE_PERFORMANCE_GC_MINOR]: 'minor',
    [constants.NODE_PERFORMANCE_GC_INCREMENTAL]: 'incremental',
    [constants.NODE_PERFORMANCE_GC_WEAKCB]: 'weakcb',
  };
  const gc = process.env.GRAFANA_BENCHMARK_GC === '1'
    ? {
        count: 0,
        durationMs: 0,
        byKind: Object.fromEntries(
          ['major', 'minor', 'incremental', 'weakcb', 'other'].map((kind) => [kind, { count: 0, durationMs: 0 }])
        ),
      }
    : null;
  const report = {
    pid: process.pid,
    ppid: process.ppid,
    workerId,
    workerModule: null,
    role,
    startedAt: new Date(performance.timeOrigin).toISOString(),
    lifetimeMs: 0,
    complete: false,
    gc,
  };
  let warned = false;
  let observer;

  function aggregate(entries) {
    for (const entry of entries) {
      const bucket = gc.byKind[kinds[entry.detail.kind] || 'other'];
      gc.count++;
      gc.durationMs += entry.duration;
      bucket.count++;
      bucket.durationMs += entry.duration;
    }
  }

  function snapshot(complete) {
    if (observer) {
      aggregate(observer.takeRecords());
    }
    report.lifetimeMs = performance.now();
    report.complete = complete;
    try {
      writeFileSync(temporary, JSON.stringify(report));
      renameSync(temporary, filename);
    } catch (error) {
      try {
        unlinkSync(temporary);
      } catch {}
      if (!warned) {
        warned = true;
        try {
          writeSync(2, `Jest benchmark: could not write process metrics: ${error.message}\n`);
        } catch {}
      }
    }
  }

  if (gc) {
    observer = new PerformanceObserver((list) => aggregate(list.getEntries()));
    observer.observe({ entryTypes: ['gc'] });
  }
  snapshot(false);
  if (role === 'worker') {
    function onInit(message) {
      if (!Array.isArray(message) || message[0] !== 0 || typeof message[2] !== 'string' || !message[2]) {
        return;
      }
      report.workerModule = message[2];
      snapshot(false);
      process.removeListener('message', onInit);
    }
    process.on('message', onInit);
  }
  const checkpoint = gc ? setInterval(() => snapshot(false), 5000).unref() : null;
  process.on('exit', () => {
    if (checkpoint) {
      clearInterval(checkpoint);
    }
    snapshot(true);
    observer?.disconnect();
  });
}
