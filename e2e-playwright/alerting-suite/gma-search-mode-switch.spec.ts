import { type Page, test, expect } from '@grafana/plugin-e2e';

import { gotoResilient } from './waitForAppLoad';

// No corpus dependency: this only exercises URL/mode wiring against whatever rules already
// exist on the instance, not specific counts.
test.describe('Search mode switch (SEARCH-7)', () => {
  test.slow();

  async function assertModeSwitchBehavior(page: Page, path: string) {
    await gotoResilient(page, path);
    await expect(page.getByRole('radio', { name: 'Folders' })).toBeChecked({ timeout: 20_000 });

    const search = page.getByRole('textbox', { name: /search/i });
    await search.fill('cpu');
    await search.press('Enter');

    await expect(page.getByRole('radio', { name: 'List' })).toBeChecked({ timeout: 20_000 });

    // Folders is unavailable while a non-folder criterion is active — clicking it is a no-op,
    // not a hard-disabled control, so assert the mode doesn't actually change.
    await page.getByRole('radio', { name: 'Folders' }).click();
    await expect(page.getByRole('radio', { name: 'List' })).toBeChecked();

    await page.getByRole('button', { name: 'Clear filters' }).click();
    // Removing the filter does not switch back automatically — List stays selected until the
    // user chooses Folders again.
    await expect(page.getByRole('radio', { name: 'List' })).toBeChecked({ timeout: 20_000 });
    await expect(search).toHaveValue('');

    await page.getByRole('radio', { name: 'Folders' }).click();
    await expect(page.getByRole('radio', { name: 'Folders' })).toBeChecked({ timeout: 20_000 });
  }

  test('SEARCH-7 (Alert rules): a filter switches to List; clearing it does not switch back on its own', async ({ page }) => {
    await assertModeSwitchBehavior(page, '/alerting/rules/alert');
  });

  test('SEARCH-7 (Recording rules): a filter switches to List; clearing it does not switch back on its own', async ({ page }) => {
    await assertModeSwitchBehavior(page, '/alerting/rules/recording');
  });
});
