import { type CDPSession, type Page, type Request, type TestInfo } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// Benchmark harness: run with --workers=1 against a production build so timings are comparable.
export const ITERATIONS = Number(process.env.PERF_ITERATIONS ?? 5);
const CPU_THROTTLE = Number(process.env.PERF_CPU_THROTTLE ?? 4);
const LABEL = process.env.PERF_LABEL ?? 'unlabelled';
const OUT = process.env.PERF_OUT ?? path.join(process.cwd(), 'playwright', 'perf', `${LABEL}.jsonl`);

const CDP_METRICS = ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'JSHeapUsedSize'];

declare global {
  interface Window {
    __perf: { longTasks: number[]; events: number[] };
    __perfSameDocument?: boolean;
  }
}

// Installed before any app code so long tasks and interaction latency are captured from first paint.
function observe() {
  window.__perf = { longTasks: [], events: [] };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      window.__perf.longTasks.push(e.duration);
    }
  }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      window.__perf.events.push(e.duration);
    }
  }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
}

const inflight = new WeakMap<Page, Map<Request, number>>();
const STALE_MS = 5000;

export async function setupPerf(page: Page): Promise<CDPSession> {
  const pending = new Map<Request, number>();
  inflight.set(page, pending);
  // Only API calls (queries, dashboards, etc.). Some requests never report finished (e.g. aborted
  // by a navigation), so a response is enough, and anything older than STALE_MS is ignored.
  page.on('request', (r) => r.url().includes('/api/') && pending.set(r, Date.now()));
  page.on('response', (r) => pending.delete(r.request()));
  page.on('requestfailed', (r) => pending.delete(r));
  await page.addInitScript(observe);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  return cdp;
}

async function cdpMetrics(cdp: CDPSession) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.filter((m) => CDP_METRICS.includes(m.name)).map((m) => [m.name, m.value]));
}

// Two rAFs + an idle callback: React has committed, the browser has painted, and the main thread is free.
export async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestIdleCallback(() => resolve(), { timeout: 5000 }))
        )
      )
  );
}

// "Done" = no request in flight for QUIET_MS, then a settled frame. Unlike networkidle this also
// works after in-page interactions (refresh, run query), not just navigations.
// ponytail: ignores long-lived requests (live/websocket) by capping the wait; fine for testdata.
const QUIET_MS = 300;
export async function waitForQuiet(page: Page, timeoutMs = 30_000) {
  const pending = inflight.get(page)!;
  const deadline = Date.now() + timeoutMs;
  let quietSince = Date.now();
  while (Date.now() < deadline) {
    const now = Date.now();
    if ([...pending.values()].some((t) => now - t < STALE_MS)) {
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= QUIET_MS) {
      break;
    }
    await page.waitForTimeout(50);
  }
  await settle(page);
}

export async function waitForPanelsLoaded(page: Page) {
  await page.getByTestId('data-testid panel content').first().waitFor();
  await waitForQuiet(page);
}

export async function measure(
  page: Page,
  cdp: CDPSession,
  testInfo: TestInfo,
  scenario: string,
  action: () => Promise<void>
) {
  // A navigation inside `action` replaces window.__perf, so reset (not read-before) is enough.
  await page
    .evaluate(() => window.__perf && ((window.__perf.longTasks = []), (window.__perf.events = [])))
    .catch(() => {});
  await page.evaluate(() => (window.__perfSameDocument = true));
  const beforeDoc = await cdpMetrics(cdp);
  const start = performance.now();

  await action();
  await waitForQuiet(page);

  const wallMs = performance.now() - start;
  const after = await cdpMetrics(cdp);
  const { longTasks, events } = await page.evaluate(() => window.__perf);
  // CDP counters reset per document, so after a navigation the totals already are the load's cost.
  const navigated = await page.evaluate(() => !window.__perfSameDocument);
  const before = navigated ? Object.fromEntries(CDP_METRICS.map((m) => [m, 0])) : beforeDoc;

  const result = {
    label: LABEL,
    scenario,
    retry: testInfo.retry,
    cpuThrottle: CPU_THROTTLE,
    wallMs,
    taskMs: (after.TaskDuration - before.TaskDuration) * 1000,
    scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
    layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
    styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
    heapMb: after.JSHeapUsedSize / 1024 / 1024,
    longTaskCount: longTasks.length,
    tbtMs: longTasks.reduce((sum, d) => sum + Math.max(0, d - 50), 0),
    maxEventMs: events.length ? Math.max(...events) : 0,
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  appendFileSync(OUT, JSON.stringify(result) + '\n');
  return result;
}
