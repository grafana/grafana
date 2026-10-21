import { test, expect } from './fixtures';

// Server runs with `alerting.gmaOnlyListView` on, so only the flag-on redirect is covered.
test.describe('Stack gate and old link', () => {
  test('an untyped old link lands on Alert rules', async ({ page }) => {
    await page.goto('/alerting/list');
    await expect(page).toHaveURL(/\/alerting\/rules\/alert(\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Alert rules' })).toBeVisible();
  });

  test('type:recording with a resolvable folder name lands on Recording rules with the migrated query', async ({
    page,
    folder,
  }) => {
    const legacySearch = `type:recording namespace:"${folder.title}"`;
    await page.goto(`/alerting/list?search=${encodeURIComponent(legacySearch)}&view=list`);

    await expect(page).toHaveURL(/\/alerting\/rules\/recording\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get('view')).toBe('list');
    expect(url.searchParams.get('search')).toBe(`namespace:${folder.uid}`);
    await expect(page.getByRole('heading', { name: 'Recording rules' })).toBeVisible();
  });

  test('malformed and unsupported filters are removed, the redirect still completes, and the warning names the filters but not their values', async ({
    page,
  }) => {
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

  test('a folder name that matches nothing is removed with a warning that names the filter', async ({ page }) => {
    const missingName = `No such folder ${crypto.randomUUID().slice(0, 8)}`;
    await page.goto(`/alerting/list?search=${encodeURIComponent(`namespace:"${missingName}"`)}&view=list`);

    await expect(page).toHaveURL(/\/alerting\/rules\/alert\?/);
    expect(new URL(page.url()).searchParams.get('search')).toBeNull();
    await expect(page.getByText('These filters could not be migrated and were removed: namespace')).toBeVisible();
    await expect(page.getByText(missingName)).toHaveCount(0);
  });

  test('a failing folder lookup still redirects and the warning names the filter', async ({ page, folder }) => {
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

  test('the legacy Recently deleted page redirects to Alert rules’ Recently deleted tab', async ({ page }) => {
    await page.goto('/alerting/recently-deleted/');
    await expect(page).toHaveURL(/\/alerting\/rules\/alert\/deleted(\?.*)?$/);
    await expect(page.getByRole('tab', { name: 'Recently deleted' })).toHaveAttribute('aria-selected', 'true');
  });
});
