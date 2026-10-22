import { type CDPSession, type Page, test } from '@playwright/test';
import fs from 'fs';

/**
 * Basemap performance harness for #135474. Throwaway: not committed.
 *
 * Env:
 *   PERF_DASHBOARD  single | grid (default single)
 *   PERF_FILTER     regex on the panel title (single) or row title (grid)
 *   PERF_RUNS       measured runs per combination, after one warm-up (default 3)
 *   PERF_SOAK_SEC   extra seconds of repeated interaction before the second heap reading (default 0)
 *   PERF_LEAK       enter/leave cycles for the leak check (default 0 = skip)
 *   PERF_OUT        JSONL file to append results to
 *   PERF_DEDUPE_FONT 1 = skip ctx.font writes that repeat the current value (experiment)
 *   PERF_COPIES     grid only: how many of the 16 repeated panels to show (default 16)
 *   PERF_STRIP_LAYERS regex on Protomaps style layer ids to remove before the style loads (experiment)
 */

const DASHBOARD = process.env.PERF_DASHBOARD ?? 'single';
const FILTER = new RegExp(process.env.PERF_FILTER ?? '.');
const RUNS = Number(process.env.PERF_RUNS ?? 3);
const SOAK_SEC = Number(process.env.PERF_SOAK_SEC ?? 0);
const LEAK_CYCLES = Number(process.env.PERF_LEAK ?? 0);
const OUT = process.env.PERF_OUT;
const COPIES = Number(process.env.PERF_COPIES ?? 16);
const DEDUPE_FONT = process.env.PERF_DEDUPE_FONT === '1';
const STRIP_LAYERS = process.env.PERF_STRIP_LAYERS ? new RegExp(process.env.PERF_STRIP_LAYERS) : undefined;
const UID = `geomap-basemap-perf-${DASHBOARD}`;
const TILE_SERVER = 'http://localhost:8095';

const TILE_HOSTS = [/localhost:8095\/(planet\.pmtiles|tiles\/)/, /basemaps\.cartocdn\.com/];
const QUIET_MS = 1500;
const LOAD_TIMEOUT_MS = 60_000;

// Tests whether redundant font writes cause the z16 label slowdown
const DEDUPE_FONT_SHIM = `
  (() => {
    const P = CanvasRenderingContext2D.prototype;
    const d = Object.getOwnPropertyDescriptor(P, 'font');
    const last = new WeakMap();
    Object.defineProperty(P, 'font', {
      ...d,
      set(v) {
        if (last.get(this) === v) return;
        last.set(this, v);
        d.set.call(this, v);
      },
    });
  })();
`;

interface Combo {
  label: string;
  url: string;
  rowTitle?: string;
  hasData: boolean;
}

// Records frame deltas and long tasks only while __perf.recording is set
const RECORDER = `
  window.__perf = { recording: false, last: null, frames: [], longtasks: [], loadLongtasks: [] };
  (function loop() {
    requestAnimationFrame((t) => {
      const p = window.__perf;
      if (p.recording) {
        if (p.last !== null) p.frames.push(t - p.last);
        p.last = t;
      }
      loop();
    });
  })();
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      (window.__perf.recording ? window.__perf.longtasks : window.__perf.loadLongtasks).push(e.duration);
    }
  }).observe({ type: 'longtask', buffered: true });
`;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email or username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page
    .getByRole('button', { name: 'Skip' })
    .or(page.getByRole('link', { name: 'Skip' }))
    .click({ timeout: 5000 })
    .catch(() => {});
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function combos(page: Page): Promise<Combo[]> {
  const res = await page.request.get(`/apis/dashboard.grafana.app/v2/namespaces/default/dashboards/${UID}`);
  const spec = (await res.json()).spec;
  if (DASHBOARD === 'single') {
    return Object.entries<any>(spec.elements)
      .map(([name, el]) => ({
        label: el.spec.title as string,
        url: `/d/${UID}?viewPanel=${name}`,
        hasData: el.spec.data.spec.queries.length > 0,
      }))
      .filter((c) => FILTER.test(c.label));
  }
  return spec.layout.spec.rows
    .map((row: any) => {
      const name = row.spec.layout.spec.items[0].spec.element.name;
      return {
        label: row.spec.title as string,
        rowTitle: row.spec.title as string,
        url: `/d/${UID}?${Array.from({ length: COPIES }, (_, i) => `var-copy=${i + 1}`).join('&')}`,
        hasData: spec.elements[name].spec.data.spec.queries.length > 0,
      };
    })
    .filter((c: Combo) => FILTER.test(c.label));
}

/** Time from navigation until tile traffic (and the data query) has been quiet for QUIET_MS */
async function loadAndWait(page: Page, combo: Combo) {
  const pending = new Set<string>();
  let tilesDone = 0;
  let firstTileAt = 0;
  let lastTileAt = 0;
  let dataDone = !combo.hasData;
  const isTile = (url: string) => TILE_HOSTS.some((re) => re.test(url));
  const onRequest = (r: any) => {
    if (isTile(r.url())) {
      firstTileAt ||= Date.now();
      pending.add(r);
    }
  };
  const onDone = (r: any) => {
    if (pending.delete(r)) {
      tilesDone++;
      lastTileAt = Date.now();
    }
    if (r.url().includes('/api/ds/query')) {
      dataDone = true;
    }
  };
  page.on('request', onRequest);
  page.on('requestfinished', onDone);
  page.on('requestfailed', onDone);

  const start = Date.now();
  await page.goto(combo.url);
  if (combo.rowTitle) {
    await page.getByText(combo.rowTitle, { exact: true }).click();
  }
  while (Date.now() - start < LOAD_TIMEOUT_MS) {
    if (tilesDone > 0 && pending.size === 0 && dataDone && Date.now() - lastTileAt > QUIET_MS) {
      break;
    }
    await page.waitForTimeout(100);
  }
  page.off('request', onRequest);
  page.off('requestfinished', onDone);
  page.off('requestfailed', onDone);
  const timedOut = Date.now() - start >= LOAD_TIMEOUT_MS;
  // ttfrMs includes Grafana boot; tileSpanMs isolates the basemap's own loading
  return { ttfrMs: lastTileAt - start, tileSpanMs: lastTileAt - firstTileAt, tileRequests: tilesDone, timedOut };
}

async function heapMB(cdp: CDPSession) {
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const used = metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
  return Math.round((used / 1024 / 1024) * 10) / 10;
}

async function drag(page: Page, x: number, y: number, dx: number, dy: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 40 });
  await page.mouse.up();
}

/** The same pan and zoom steps every run, centered on the first map */
async function interact(page: Page) {
  const box = await page.locator('.ol-viewport').first().boundingBox();
  if (!box) {
    throw new Error('No map on the page');
  }
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const d = Math.min(box.width, box.height) / 3;
  for (let i = 0; i < 2; i++) {
    await drag(page, cx, cy, d, 0);
    await drag(page, cx, cy, -d, 0);
    await drag(page, cx, cy, 0, d);
    await drag(page, cx, cy, 0, -d);
    for (const delta of [-100, -100, -100, 100, 100, 100]) {
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(400);
    }
  }
  if (DASHBOARD === 'grid') {
    // Scrolling past the other maps is part of the cost that grows with panel count
    await page.mouse.move(box.x + box.width + 5, cy);
    for (const delta of [400, 400, -400, -400]) {
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(400);
    }
  }
}

function pct(values: number[], p: number) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] * 10) / 10;
}

async function tileStats(page: Page) {
  try {
    return await (await page.request.get(`${TILE_SERVER}/stats`)).json();
  } catch {
    return null;
  }
}

async function measure(page: Page, cdp: CDPSession, combo: Combo) {
  const statsBefore = await tileStats(page);
  const load = await loadAndWait(page, combo);
  const heapAfterLoad = await heapMB(cdp);

  await page.evaluate(() => {
    const p = (window as any).__perf;
    Object.assign(p, { recording: true, last: null, frames: [], longtasks: [] });
  });
  await interact(page);
  const perf = await page.evaluate(() => {
    const p = (window as any).__perf;
    p.recording = false;
    return {
      frames: p.frames as number[],
      longtasks: p.longtasks as number[],
      loadLongtasks: p.loadLongtasks as number[],
    };
  });
  const heapAfterInteraction = await heapMB(cdp);

  let heapAfterSoak: number | undefined;
  if (SOAK_SEC > 0) {
    const until = Date.now() + SOAK_SEC * 1000;
    while (Date.now() < until) {
      await interact(page);
    }
    heapAfterSoak = await heapMB(cdp);
  }
  const statsAfter = await tileStats(page);

  return {
    ...load,
    heapAfterLoadMB: heapAfterLoad,
    heapAfterInteractionMB: heapAfterInteraction,
    heapAfterSoakMB: heapAfterSoak,
    frames: perf.frames.length,
    frameP50: pct(perf.frames, 50),
    frameP95: pct(perf.frames, 95),
    frameP99: pct(perf.frames, 99),
    framesOver50ms: perf.frames.filter((f) => f > 50).length,
    longTasks: perf.longtasks.length,
    longTaskMs: Math.round(perf.longtasks.reduce((a, b) => a + b, 0)),
    loadLongTaskMs: Math.round(perf.loadLongtasks.reduce((a, b) => a + b, 0)),
    serverArchiveRequests:
      statsBefore && statsAfter ? statsAfter.archive.requests - statsBefore.archive.requests : undefined,
    serverArchiveBytes: statsBefore && statsAfter ? statsAfter.archive.bytes - statsBefore.archive.bytes : undefined,
    serverTileRequests: statsBefore && statsAfter ? statsAfter.tiles.requests - statsBefore.tiles.requests : undefined,
  };
}

async function leakCheck(page: Page, cdp: CDPSession, combo: Combo) {
  const heaps: number[] = [];
  for (let i = 0; i < LEAK_CYCLES; i++) {
    await loadAndWait(page, combo);
    await page.goto('/');
    await page.waitForTimeout(1000);
    heaps.push(await heapMB(cdp));
  }
  return heaps;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

test('basemap performance', async ({ page, context, browserName }) => {
  await page.addInitScript(RECORDER);
  // Without this a crashed tab leaves every later await hanging, since the test has no timeout
  page.on('crash', () => {
    throw new Error('The page crashed, most likely out of memory');
  });
  if (DEDUPE_FONT) {
    await page.addInitScript(DEDUPE_FONT_SHIM);
  }
  if (STRIP_LAYERS) {
    await page.route(`${TILE_SERVER}/styles/*.json`, async (route) => {
      const style = await (await route.fetch()).json();
      style.layers = style.layers.filter((l: { id: string }) => !STRIP_LAYERS.test(l.id));
      await route.fulfill({ json: style });
    });
  }
  await login(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');

  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  console.log(`GPU: ${gpu}`);
  if (/swiftshader/i.test(gpu)) {
    throw new Error('WebGL is on SwiftShader, so marker numbers would be CPU-bound. Re-run with PERF_HEADED=1.');
  }

  const list = await combos(page);
  console.log(`${list.length} combinations, ${RUNS} runs each after a warm-up`);
  const meta = {
    at: new Date().toISOString(),
    dashboard: DASHBOARD,
    browser: browserName,
    gpu,
    dpr: Number(process.env.PERF_DPR ?? 1),
    dedupeFont: DEDUPE_FONT,
    copies: DASHBOARD === 'grid' ? COPIES : null,
    stripLayers: process.env.PERF_STRIP_LAYERS ?? null,
  };

  for (const combo of list) {
    await measure(page, cdp, combo); // warm-up: fills the HTTP cache, discarded
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      runs.push(await measure(page, cdp, combo));
    }
    const leak = LEAK_CYCLES > 0 ? await leakCheck(page, cdp, combo) : undefined;
    const summary = {
      ...meta,
      combo: combo.label,
      runs,
      median: {
        ttfrMs: median(runs.map((r) => r.ttfrMs)),
        tileSpanMs: median(runs.map((r) => r.tileSpanMs)),
        frameP95: median(runs.map((r) => r.frameP95)),
        framesOver50ms: median(runs.map((r) => r.framesOver50ms)),
        longTaskMs: median(runs.map((r) => r.longTaskMs)),
        heapAfterInteractionMB: median(runs.map((r) => r.heapAfterInteractionMB)),
      },
      leakHeapsMB: leak,
    };
    console.log(
      `${combo.label}: ttfr ${summary.median.ttfrMs}ms, tiles ${summary.median.tileSpanMs}ms, p95 ${summary.median.frameP95}ms, ` +
        `>50ms ${summary.median.framesOver50ms}, longtask ${summary.median.longTaskMs}ms, ` +
        `heap ${summary.median.heapAfterInteractionMB}MB${runs.some((r) => r.timedOut) ? ' (load timed out)' : ''}`
    );
    if (OUT) {
      fs.appendFileSync(OUT, JSON.stringify(summary) + '\n');
    }
  }
});
