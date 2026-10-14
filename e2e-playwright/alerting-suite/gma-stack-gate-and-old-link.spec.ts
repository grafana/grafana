import { test, expect } from './fixtures';

// The Grafana server these specs run on starts with `alerting.gmaOnlyListView` on (see
// scripts/grafana-server/custom-gma-rule-list.ini), so only the "flag on" half of NAV-1 is
// exercisable here — the "flag off" half (old page stays, new routes unavailable) is covered by
// Integration tests instead.
test.describe('Stack gate and old link', () => {
  test('NAV-1: an untyped old link lands on Alert rules', async ({ page }) => {
    await page.goto('/alerting/list');
    await expect(page).toHaveURL(/\/alerting\/rules\/alert(\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Alert rules' })).toBeVisible();
  });

  test('NAV-3: type:recording with a resolvable folder name lands on Recording rules with the migrated query', async ({
    page,
    folder,
  }) => {
    // The folder is this worker's own, so its exact title resolves to exactly one UID on any stack.
    const legacySearch = `type:recording namespace:"${folder.title}"`;
    await page.goto(`/alerting/list?search=${encodeURIComponent(legacySearch)}&view=list`);

    await expect(page).toHaveURL(/\/alerting\/rules\/recording\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get('view')).toBe('list');
    // type: is consumed for routing and removed; namespace: keeps its resolved UID, not the name.
    expect(url.searchParams.get('search')).toBe(`namespace:${folder.uid}`);
    await expect(page.getByRole('heading', { name: 'Recording rules' })).toBeVisible();
  });

  test('NAV-4: malformed and unsupported filters are removed, the redirect still completes, and the warning names the filters but not their values', async ({
    page,
  }) => {
    // `group:` no longer exists, `foo:` is unknown, and the unterminated quote makes `label:` malformed.
    const legacySearch = 'foo:bar group:infra label:"payments-secret';
    await page.goto(`/alerting/list?search=${encodeURIComponent(legacySearch)}&view=list`);

    await expect(page).toHaveURL(/\/alerting\/rules\/alert\?/);
    expect(new URL(page.url()).searchParams.get('search')).toBeNull();
    await expect(page.getByText('Some filters were removed')).toBeVisible();
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
    await page.goto(`/alerting/list?search=${encodeURIComponent(`namespace:"${missingName}"`)}&view=list`);

    await expect(page).toHaveURL(/\/alerting\/rules\/alert\?/);
    expect(new URL(page.url()).searchParams.get('search')).toBeNull();
    await expect(page.getByText('These filters could not be migrated and were removed: namespace')).toBeVisible();
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

    await page.goto(`/alerting/list?search=${encodeURIComponent(`namespace:"${folder.title}"`)}&view=list`);

    await expect(page).toHaveURL(/\/alerting\/rules\/alert\?/);
    expect(new URL(page.url()).searchParams.get('search')).toBeNull();
    await expect(page.getByText('These filters could not be migrated and were removed: namespace')).toBeVisible();
  });

  test('NAV-1/NAV-3: the legacy Recently deleted page redirects to Alert rules’ Recently deleted tab', async ({
    page,
  }) => {
    await page.goto('/alerting/recently-deleted/');
    await expect(page).toHaveURL(/\/alerting\/rules\/alert\/deleted(\?.*)?$/);
    await expect(page.getByRole('tab', { name: 'Recently deleted' })).toHaveAttribute('aria-selected', 'true');
  });
});
