import { test, expect } from './fixtures';
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
    folder,
  }) => {
    // The folder is this worker's own, so its exact title resolves to exactly one UID on any stack.
    // Resolution dispatches its own RTK Query request before the redirect fires, so give it more
    // room than the default 10s under concurrent load.
    const legacySearch = `type:recording namespace:"${folder.title}"`;
    await gotoResilient(page, `/alerting/list?search=${encodeURIComponent(legacySearch)}&view=list`);

    await expect(page).toHaveURL(/\/alerting\/rules\/recording\?/, { timeout: 40_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('view')).toBe('list');
    // type: is consumed for routing and removed; namespace: keeps its resolved UID, not the name.
    expect(url.searchParams.get('search')).toBe(`namespace:${folder.uid}`);
    await expect(page.getByRole('heading', { name: 'Recording rules' })).toBeVisible({ timeout: 40_000 });
  });

  test('NAV-4: malformed and unsupported filters are removed, the redirect still completes, and the warning names the filters but not their values', async ({
    page,
  }) => {
    // `group:` no longer exists, `foo:` is unknown, and the unterminated quote makes `label:` malformed.
    const legacySearch = 'foo:bar group:infra label:"payments-secret';
    await gotoResilient(page, `/alerting/list?search=${encodeURIComponent(legacySearch)}&view=list`);

    await expect(page).toHaveURL(/\/alerting\/rules\/alert\?/, { timeout: 40_000 });
    expect(new URL(page.url()).searchParams.get('search')).toBeNull();
    await expect(page.getByText('Some filters were removed')).toBeVisible({ timeout: 40_000 });
    await expect(
      page.getByText('These filters could not be migrated and were removed: foo, group, label')
    ).toBeVisible();
    await expect(page.getByText('payments-secret')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Alert rules' })).toBeVisible();
  });

  test('NAV-4: a folder name that matches nothing is removed with a warning that names the filter', async ({
    page,
  }) => {
    const missingName = `No such folder ${crypto.randomUUID().slice(0, 8)}`;
    await gotoResilient(page, `/alerting/list?search=${encodeURIComponent(`namespace:"${missingName}"`)}&view=list`);

    await expect(page).toHaveURL(/\/alerting\/rules\/alert\?/, { timeout: 40_000 });
    expect(new URL(page.url()).searchParams.get('search')).toBeNull();
    await expect(page.getByText('These filters could not be migrated and were removed: namespace')).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.getByText(missingName)).toHaveCount(0);
  });

  test('NAV-4: a failing folder lookup still redirects and the warning names the filter', async ({ page, folder }) => {
    // Only the title lookup the migration makes fails; the folder list the destination page loads does not.
    await page.route('**/folders/search', async (route) => {
      if (route.request().postData()?.includes('"text"')) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"lookup failed"}' });
      } else {
        await route.continue();
      }
    });

    await gotoResilient(page, `/alerting/list?search=${encodeURIComponent(`namespace:"${folder.title}"`)}&view=list`);

    await expect(page).toHaveURL(/\/alerting\/rules\/alert\?/, { timeout: 40_000 });
    expect(new URL(page.url()).searchParams.get('search')).toBeNull();
    await expect(page.getByText('These filters could not be migrated and were removed: namespace')).toBeVisible({
      timeout: 40_000,
    });
  });

  test('NAV-1/NAV-3: the legacy Recently deleted page redirects to Alert rules’ Recently deleted tab', async ({
    page,
  }) => {
    await gotoResilient(page, '/alerting/recently-deleted/');
    await expect(page).toHaveURL(/\/alerting\/rules\/alert\/deleted(\?.*)?$/, { timeout: 40_000 });
    await expect(page.getByRole('tab', { name: 'Recently deleted' })).toHaveAttribute('aria-selected', 'true');
  });
});
