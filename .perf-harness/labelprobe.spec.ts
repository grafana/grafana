import { type Page, test } from '@playwright/test';

// Probe for #135474: which label texts each basemap actually draws on screen at the panel's starting view
const PANELS = (process.env.PROBE_PANELS ?? 'panel-65,panel-67').split(',');
const MATCH = new RegExp(process.env.PROBE_MATCH ?? '.', 'i');

const RECORDER = `
  (() => {
    const P = CanvasRenderingContext2D.prototype;
    const seen = (window.__labels = new Map());
    for (const name of ['fillText', 'strokeText']) {
      const orig = P[name];
      P[name] = function (text, ...rest) {
        if (this.canvas.isConnected && name === 'fillText') seen.set(String(text), (seen.get(String(text)) ?? 0) + 1);
        return orig.call(this, text, ...rest);
      };
    }
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

test('labels drawn', async ({ page }) => {
  await page.addInitScript(RECORDER);
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 200));
  });
  await login(page);
  for (const panel of PANELS) {
    await page.goto(`/d/geomap-basemap-perf-single?viewPanel=${panel}`);
    await page.locator('.ol-viewport').first().waitFor();
    await page.evaluate(() => (window as any).__labels.clear());
    await page.waitForTimeout(8000);
    const labels: Array<[string, number]> = await page.evaluate(() => [...(window as any).__labels.entries()]);
    const texts = labels.map(([t]) => t).filter((t) => t.trim().length > 1);
    const matched = texts.filter((t) => MATCH.test(t));
    console.log(`[labels] ${panel} distinct=${texts.length} matched=${JSON.stringify(matched.slice(0, 200))}`);
  }
});
