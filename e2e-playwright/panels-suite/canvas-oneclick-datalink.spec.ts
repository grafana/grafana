import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'oneclick-canvas-datalink';

test.use({
  viewport: { width: 1280, height: 800 },
});

test.describe('Panels test: Canvas oneClick data link', { tag: ['@panels', '@canvas'] }, () => {
  test('clicking a oneClick element soft-updates the variable via SPA navigation', async ({
    gotoDashboardPage,
    page,
  }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ 'var-foo': 'a' }),
    });

    const oneClickRect = page.getByText('Click me', { exact: false });
    await expect(oneClickRect, 'oneClick rectangle is rendered').toBeVisible();

    // Sentinel survives SPA navigation but is wiped by a full page reload.
    await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
    });

    await oneClickRect.click({ force: true });

    await expect(page).toHaveURL(/var-foo=b/);

    const sentinel = await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload === true);
    expect(sentinel, 'no full page reload occurred').toBe(true);
  });
});
