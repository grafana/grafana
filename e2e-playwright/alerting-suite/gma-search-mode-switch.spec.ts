import { type Page } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import { gotoResilient } from './waitForAppLoad';

// No corpus dependency: this only exercises URL/mode wiring against whatever rules already
// exist on the instance, not specific counts.
test.describe('Search mode switch (SEARCH-7)', () => {
  test.slow();

  async function assertModeSwitchBehavior(page: Page, path: string) {
    await gotoResilient(page, path);
    await expect(page.getByRole('radio', { name: 'Folders' })).toBeChecked({ timeout: 20_000 });

    const search = page.getByRole('textbox', { name: /^search/i });
    await search.fill('cpu');
    await search.press('Enter');

    await expect(page.getByRole('radio', { name: 'List' })).toBeChecked({ timeout: 20_000 });
    await expect(page).toHaveURL(/view=list/);

    // Folders is unavailable while a non-folder criterion is applied, and says how to get it back.
    await expect(page.getByRole('radio', { name: 'Folders' })).toBeDisabled();
    await page
      .getByRole('radiogroup')
      .filter({ has: page.getByRole('radio', { name: 'Folders' }) })
      .hover();
    await expect(page.getByText('Clear filters to browse by folder')).toBeVisible();

    // Clearing the last non-folder filter returns to Folders.
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('radio', { name: 'Folders' })).toBeChecked({ timeout: 20_000 });
    await expect(page.getByRole('radio', { name: 'Folders' })).toBeEnabled();
  }

  test('SEARCH-7 (Alert rules): a filter switches to List with Folders disabled; clearing it returns to Folders', async ({
    page,
  }) => {
    await assertModeSwitchBehavior(page, '/alerting/rules/alert');
  });

  test('SEARCH-7 (Recording rules): a filter switches to List with Folders disabled; clearing it returns to Folders', async ({
    page,
  }) => {
    await assertModeSwitchBehavior(page, '/alerting/rules/recording');
  });
});
