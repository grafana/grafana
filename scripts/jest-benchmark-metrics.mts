import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import path from 'node:path';

import type { RssMetrics } from './jest-benchmark-rss.mts';

interface GcCount {
  count: number;
  durationMs: number;
}

interface GcMetrics extends GcCount {
  byKind: Record<string, GcCount>;
}

interface ProcessMetrics {
  pid: number;
  ppid: number;
  workerId: string | null;
  workerModule: string | null;
  role: 'coordinator' | 'worker' | 'child';
  startedAt: string;
  lifetimeMs: number;
  complete: boolean;
  gc: GcMetrics | null;
}

export async function collectProcessMetrics(directory: string, gcEnabled: boolean) {
  const processes: ProcessMetrics[] = [];
  const errors: string[] = [];
  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.json')).sort()) {
    try {
      processes.push(JSON.parse(await readFile(path.join(directory, file), 'utf8')));
    } catch (error) {
      errors.push(`Cannot read process metrics ${file}: ${String(error)}`);
    }
  }
  if (!processes.some((entry) => entry.role === 'coordinator')) {
    errors.push('The Jest coordinator did not report process metrics. Worker counts can be incomplete.');
  }
  const pool = (entry: ProcessMetrics, suffix: string) =>
    entry.role === 'worker' && entry.workerModule?.replaceAll('\\', '/').endsWith(suffix);
  const workers = processes.filter((entry) => pool(entry, '/jest-runner/build/testWorker.js'));
  const hasteMapWorkers = processes.filter((entry) => pool(entry, '/jest-haste-map/build/worker.js'));
  const otherWorkers = processes.filter((entry) => entry.role === 'worker').length - workers.length - hasteMapWorkers.length;
  const gc: GcMetrics | null = gcEnabled ? { count: 0, durationMs: 0, byKind: {} } : null;
  for (const entry of processes) {
    if (gc && entry.gc) {
      gc.count += entry.gc.count;
      gc.durationMs += entry.gc.durationMs;
      for (const [kind, value] of Object.entries(entry.gc.byKind)) {
        const bucket = (gc.byKind[kind] ??= { count: 0, durationMs: 0 });
        bucket.count += value.count;
        bucket.durationMs += value.durationMs;
      }
    }
  }
  return {
    workerStarts: workers.length,
    // Worker IDs identify slots, not lifetimes. A replacement uses the same ID.
    workerReplacements: workers.length - new Set(workers.map((entry) => `${entry.ppid}:${entry.workerModule}:${entry.workerId}`)).size,
    hasteMapWorkerStarts: hasteMapWorkers.length,
    otherWorkerStarts: otherWorkers,
    processStarts: processes.length,
    incompleteProcesses: processes.filter((entry) => !entry.complete).length,
    gc,
    processes,
    errors,
  };
}

export async function benchmarkMetadata(rootDir: string, configFile: string) {
  const git = (args: string[]) => {
    const result = spawnSync('git', ['--no-pager', '--no-optional-locks', ...args], {
      cwd: rootDir,
      encoding: 'utf8',
      timeout: 5000,
    });
    return result.status === 0 ? result.stdout.trim() : null;
  };
  const trackedStatus = git(['status', '--porcelain', '--untracked-files=no']);
  const configurationHashes: Record<string, string> = {};
  for (const file of new Set(['jest.config.js', configFile])) {
    configurationHashes[file] = createHash('sha256').update(await readFile(path.join(rootDir, file))).digest('hex');
  }
  const runnerHash = createHash('sha256');
  for (const file of ['jest-benchmark.mts', 'jest-benchmark-metrics.mts', 'jest-benchmark-rss.mts', 'jest-benchmark-process.cjs', 'jest-benchmark-config.mts']) {
    runnerHash.update(file).update(await readFile(new URL(`./${file}`, import.meta.url)));
  }
  const cpuInfo = cpus();
  return {
    runnerHash: runnerHash.digest('hex'),
    revision: git(['rev-parse', 'HEAD']),
    trackedChanges: trackedStatus === null ? null : trackedStatus.length > 0,
    node: process.version,
    nodeOptions: process.env.NODE_OPTIONS ?? '',
    platform: process.platform,
    arch: process.arch,
    cpuModel: cpuInfo[0]?.model ?? null,
    logicalCpus: cpuInfo.length,
    systemMemoryBytes: totalmem(),
    configurationHashes,
  };
}

export function printMetrics({
  executionMs,
  totalMs,
  exitCode,
  metricsEnabled,
  rss,
  processes,
}: {
  executionMs: number;
  totalMs: number;
  exitCode: number;
  metricsEnabled: boolean;
  rss: RssMetrics | null;
  processes: Awaited<ReturnType<typeof collectProcessMetrics>> | null;
}) {
  const seconds = (ms: number, decimals: number) => `${(ms / 1000).toFixed(decimals)} s`;
  const mib = (bytes: number | null) => {
    if (!rss) {
      return 'unavailable';
    }
    if (!rss.supported) {
      return 'unavailable (requires Linux /proc)';
    }
    if (!rss.samples || bytes === null) {
      return 'unavailable (no valid samples)';
    }
    return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  };
  const rows: Array<[string, string | number]> = [
    ['Timing', ''],
    ['  Jest execution', seconds(executionMs, 2)],
    ['  Total (discovery/setup included)', seconds(totalMs, 2)],
    ['  Exit code', exitCode],
  ];
  if (!metricsEnabled) {
    rows.push(['Instrumentation', 'disabled (--noMetrics)']);
  } else {
    rows.push(
      [`Memory (summed RSS${rss ? ` @ ${rss.intervalMs}ms` : ''})`, rss?.errors.length ? 'INCOMPLETE' : ''],
      ['  Sampled peak', mib(rss?.peakBytes ?? null)],
      ['  Time-weighted average', mib(rss?.averageBytes ?? null)],
      ['  Samples', rss?.samples ?? 'unavailable'],
      ['Processes', processes ? (processes.errors.length ? 'INCOMPLETE' : '') : 'unavailable'],
      ['  Node process starts', processes?.processStarts ?? 'unavailable'],
      ['  Test-worker starts', processes?.workerStarts ?? 'unavailable'],
      ['  Test-worker replacements', processes?.workerReplacements ?? 'unavailable'],
      ['  Haste-map worker starts', processes?.hasteMapWorkerStarts ?? 'unavailable'],
      ['  Other worker starts', processes?.otherWorkerStarts ?? 'unavailable']
    );
    if (!processes) {
      rows.push(['GC (observed aggregate)', 'unavailable']);
    } else if (!processes.gc) {
      rows.push(['GC (observed aggregate)', 'disabled (--noGc)']);
    } else {
      rows.push(
        ['GC (observed aggregate)', processes.incompleteProcesses || processes.errors.length ? 'INCOMPLETE' : ''],
        ['  Duration', seconds(processes.gc.durationMs, 3)],
        ['  Events', processes.gc.count],
        ['  Major duration', seconds(processes.gc.byKind.major?.durationMs ?? 0, 3)],
        ['  Minor duration', seconds(processes.gc.byKind.minor?.durationMs ?? 0, 3)],
        ['  Missing final reports', processes.incompleteProcesses]
      );
    }
  }
  const width = Math.max(...rows.map(([label]) => label.length));
  const table = rows.map(([label, value]) => (value === '' ? label : `${label.padEnd(width)}  ${value}`)).join('\n');
  console.log(`\nBenchmark summary\n${table}`);

  if (metricsEnabled) {
    for (const error of [...(rss?.errors ?? []), ...(processes?.errors ?? [])]) {
      console.error(`Benchmark metrics warning: ${error}`);
    }
  }
}
