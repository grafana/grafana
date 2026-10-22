import { type Page, test } from '@playwright/test';

// Probe for #135474: how many ctx.font writes per frame land on on-screen canvases, and how many repeat the value already set
const PANELS = (process.env.PROBE_PANELS ?? 'panel-64,panel-66,panel-69').split(',');

const COUNTER = `
  (() => {
    const P = CanvasRenderingContext2D.prototype;
    const d = Object.getOwnPropertyDescriptor(P, 'font');
    const last = new WeakMap();
    const s = (window.__fw = { on: false, cur: { n: 0, same: 0 }, frames: [], values: new Map(), canvases: new Set() });
    Object.defineProperty(P, 'font', {
      ...d,
      set(v) {
        if (s.on && this.canvas.isConnected) {
          s.cur.n++;
          if (last.get(this) === v) s.cur.same++;
          s.values.set(v, (s.values.get(v) ?? 0) + 1);
          s.canvases.add(this.canvas);
        }
        last.set(this, v);
        d.set.call(this, v);
      },
    });
    const tick = () => { if (s.on) { s.frames.push(s.cur); s.cur = { n: 0, same: 0 }; } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  })();
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

test('font writes per frame', async ({ page }) => {
  await page.addInitScript(COUNTER);
  await login(page);
  for (const panel of PANELS) {
    await page.goto(`/d/geomap-basemap-perf-single?viewPanel=${panel}`);
    await page.locator('.ol-viewport').first().waitFor();
    await page.waitForTimeout(5000);
    const box = (await page.locator('.ol-viewport').first().boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.evaluate(() => ((window as any).__fw.on = true));
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 200, cy, { steps: 40 });
    await page.mouse.up();
    for (const delta of [-100, -100, -100, 100, 100, 100]) {
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(400);
    }
    const r = await page.evaluate(() => {
      const s = (window as any).__fw;
      s.on = false;
      const f = s.frames.filter((x: any) => x.n > 0);
      const n = f.map((x: any) => x.n).sort((a: number, b: number) => a - b);
      const total = n.reduce((a: number, b: number) => a + b, 0);
      const same = f.reduce((a: number, x: any) => a + x.same, 0);
      const top = [...s.values.entries()].sort((a: any, b: any) => b[1] - a[1]).slice(0, 6);
      const out = {
        framesWithWrites: f.length,
        frames: s.frames.length,
        median: n[Math.floor(n.length / 2)] ?? 0,
        max: n[n.length - 1] ?? 0,
        total,
        sameAsCurrentPct: total ? Math.round((100 * same) / total) : 0,
        distinctFonts: s.values.size,
        canvases: s.canvases.size,
        top,
      };
      s.frames = [];
      s.values = new Map();
      s.canvases = new Set();
      return out;
    });
    console.log(`[fontwrites] ${panel} ${JSON.stringify(r)}`);
  }
});
