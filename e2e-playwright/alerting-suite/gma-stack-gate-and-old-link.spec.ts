import { test, expect } from '@grafana/plugin-e2e';

import { gotoResilient } from './waitForAppLoad';

// This stack has `alerting.gmaOnlyListView` permanently on, so only the "flag on" half of
// NAV-1 is exercisable here — the "flag off" half (old page stays, new routes unavailable)
// needs a stack with the flag off and is covered by Integration tests instead.
//
// test.slow() triples the test timeout — this dev instance's rspack watcher rebuilds on every
// file change from any concurrently running agent, and a request landing mid-rebuild is slow
// rather than broken (see waitForAppLoad.ts).
test.describe('Stack gate and old link', () => {
  test.slow();

  test('NAV-1: an untyped old link lands on Alert rules', async ({ page }) => {
    await gotoResilient(page, '/alerting/list');
    await expect(page).toHaveURL(/\/alerting\/rules\/alert(\?.*)?$/, { timeout: 40_000 });
    await expect(page.getByRole('heading', { name: 'Alert rules' })).toBeVisible({ timeout: 40_000 });
  });

  test('NAV-3: type:recording with a resolvable folder name lands on Recording rules with the migrated query', async ({
    page,
  }) => {
    // "Checkout" is a folder title already present on this stack — used here only to prove
    // name-to-UID resolution works, not as a fixture this test owns or mutates. Resolution
    // dispatches its own RTK Query request before the redirect fires, so give it more room
    // than the default 10s under concurrent load.
    await gotoResilient(page, '/alerting/list?search=type%3Arecording%20namespace%3ACheckout&view=list');

    await expect(page).toHaveURL(/\/alerting\/rules\/recording\?/, { timeout: 40_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('view')).toBe('list');
    // type: is consumed for routing and removed; namespace: keeps its resolved UID, not the name.
    expect(url.searchParams.get('search')).toBe('namespace:checkout');
    await expect(page.getByRole('heading', { name: 'Recording rules' })).toBeVisible({ timeout: 40_000 });
  });

  test('NAV-1/NAV-3: the legacy Recently deleted page redirects to Alert rules’ Recently deleted tab', async ({
    page,
  }) => {
    await gotoResilient(page, '/alerting/recently-deleted/');
    await expect(page).toHaveURL(/\/alerting\/rules\/alert\/deleted(\?.*)?$/, { timeout: 40_000 });
    await expect(page.getByRole('tab', { name: 'Recently deleted' })).toHaveAttribute('aria-selected', 'true');
  });
});
