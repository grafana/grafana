import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

export interface RssMetrics {
  supported: boolean;
  intervalMs: number;
  samples: number;
  peakBytes: number | null;
  averageBytes: number | null;
  durationMs: number;
  errors: string[];
}

interface SamplerOptions {
  intervalMs?: number;
  // Injectable OS and clock boundaries keep tests independent of wall-clock timing.
  platform?: string;
  now?: () => number;
  readText?: (path: string, signal: AbortSignal) => Promise<string>;
  listTasks?: (path: string) => Promise<string[]>;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

export function startRssSampler(pid: number, options: SamplerOptions = {}): { stop(): Promise<RssMetrics> } {
  const intervalMs = options.intervalMs ?? 250;
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new RangeError('pid must be a positive safe integer');
  }
  if (!Number.isFinite(intervalMs) || intervalMs <= 0 || intervalMs > 2 ** 31 - 1) {
    throw new RangeError('intervalMs must be positive and at most 2147483647');
  }
  const now = options.now ?? (() => performance.now());
  const readText = options.readText ?? ((path, signal) => readFile(path, { encoding: 'utf8', signal }));
  const listTasks = options.listTasks ?? ((path) => readdir(path));
  const sleep = options.sleep ?? ((ms, signal) => delay(ms, undefined, { signal }));
  const supported = (options.platform ?? process.platform) === 'linux';
  const controller = new AbortController();
  const { signal } = controller;
  const started = now();
  const known = new Set([pid]);
  const errors = new Set<string>();
  let samples = 0;
  let peakBytes: number | null = null;
  let previous: number | null = null;
  let previousAt = started;
  let area = 0;
  let stoppedAt: number | undefined;
  let result: Promise<RssMetrics> | undefined;

  function recordError(error: unknown) {
    const detail = (error instanceof Error ? error.message : String(error)).slice(0, 240);
    if (errors.size < 8) {
      errors.add(detail);
    }
  }

  async function poll(): Promise<number | null> {
    let incomplete = false;
    async function read<T>(path: string, operation: () => Promise<T>): Promise<T | null | undefined> {
      signal.throwIfAborted();
      try {
        return await operation();
      } catch (error) {
        signal.throwIfAborted();
        const code = (error as NodeJS.ErrnoException)?.code;
        if (code !== 'ENOENT' && code !== 'ESRCH') {
          incomplete = true;
          recordError(`${path}: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        }
        return undefined;
      }
    }

    let total = 0;
    const visited = new Set<number>();
    // Seed every poll with known descendants: they can outlive or be reparented away from the root.
    const queue = [...known];
    for (const current of queue) {
      signal.throwIfAborted();
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const base = `/proc/${current}`;
      const status = await read(`${base}/status`, () => readText(`${base}/status`, signal));
      if (status == null) {
        if (status === undefined) {
          known.delete(current);
        }
        continue;
      }
      const rss = /^VmRSS:\s+(\d+)\s+kB\s*$/m.exec(status);
      if (rss) {
        total += Number(rss[1]) * 1024;
      } else if (!/^State:\s+[ZX]\b/m.test(status)) {
        incomplete = true;
        recordError(`${base}/status: missing or invalid VmRSS`);
      }
      const tasks = await read(`${base}/task`, () => listTasks(`${base}/task`));
      for (const tid of tasks ?? []) {
        if (!/^\d+$/.test(tid)) {
          continue;
        }
        const path = `${base}/task/${tid}/children`;
        const children = await read(path, () => readText(path, signal));
        for (const child of children?.match(/\d+/g) ?? []) {
          const childPid = Number(child);
          if (Number.isSafeInteger(childPid) && childPid > 0) {
            known.add(childPid);
            queue.push(childPid);
          }
        }
      }
    }
    return incomplete ? null : total;
  }

  async function run() {
    try {
      while (!signal.aborted) {
        const at = now();
        const bytes = await poll();
        if (signal.aborted) {
          break;
        }
        if (bytes !== null) {
          // Left-hold integration: a sample applies until the next successful poll or stop.
          area += (previous ?? 0) * (at - previousAt);
          previous = bytes;
          previousAt = samples === 0 ? started : at;
          samples++;
          peakBytes = Math.max(peakBytes ?? 0, bytes);
        }
        await sleep(Math.max(0, intervalMs - (now() - at)), signal);
      }
    } catch (error) {
      if (!signal.aborted) {
        recordError(error);
      }
    }
  }

  const running = supported ? run() : Promise.resolve();
  return {
    stop() {
      if (!result) {
        stoppedAt = now();
        controller.abort();
        result = running.then(() => {
          const durationMs = Math.max(0, stoppedAt! - started);
          const weightedBytes = area + (previous ?? 0) * Math.max(0, stoppedAt! - previousAt);
          return {
            supported,
            intervalMs,
            samples,
            peakBytes,
            averageBytes: previous === null ? null : durationMs === 0 ? previous : weightedBytes / durationMs,
            durationMs,
            errors: [...errors],
          };
        });
      }
      return result;
    },
  };
}
