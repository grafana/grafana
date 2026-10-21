import { type Page } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

test.describe('Search mode switch', () => {
  async function assertModeSwitchBehavior(page: Page, path: string) {
    await page.goto(path);
    await expect(page.getByRole('radio', { name: 'Folders' })).toBeChecked();

    const search = page.getByRole('textbox', { name: /^search/i });
    await search.fill('cpu');
    await search.press('Enter');

    await expect(page.getByRole('radio', { name: 'List' })).toBeChecked();
    await expect(page).toHaveURL(/view=list/);

    await expect(page.getByRole('radio', { name: 'Folders' })).toBeDisabled();
    await page
      .getByRole('radiogroup')
      .filter({ has: page.getByRole('radio', { name: 'Folders' }) })
      .hover();
    await expect(page.getByText('Clear filters to browse by folder')).toBeVisible();

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('radio', { name: 'Folders' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Folders' })).toBeEnabled();
  }

  test('Alert rules: a filter switches to List with Folders disabled; clearing it returns to Folders', async ({
    page,
  }) => {
    await assertModeSwitchBehavior(page, '/alerting/rules/alert');
  });

  test('Recording rules: a filter switches to List with Folders disabled; clearing it returns to Folders', async ({
    page,
  }) => {
    await assertModeSwitchBehavior(page, '/alerting/rules/recording');
  });
});
