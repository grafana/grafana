import { test, expect } from '@grafana/plugin-e2e';

import { gotoResilient } from './waitForAppLoad';

// SAVE-1: save/apply, and proof that Alert and Recording keep separate collections. Cleans
// up the search it creates so this stack's persisted state doesn't grow across runs.
test.describe('Saved search', () => {
  test.slow();

  test('SAVE-1: a saved Alert search applies correctly and is invisible from the Recording page', async ({ page }) => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const name = `Checkout errors ${suffix}`;

    await gotoResilient(page, '/alerting/rules/alert');

    const search = page.getByRole('textbox', { name: /search/i });
    await search.fill('cpu');
    await search.press('Enter');
    await expect(page).toHaveURL(/search=cpu/, { timeout: 20_000 });

    const dialog = page.getByRole('dialog', { name: 'Saved searches' });
    await page.getByRole('button', { name: 'Saved searches' }).click();
    await dialog.getByRole('button', { name: 'Save current search' }).click();
    await dialog.getByRole('textbox', { name: 'Enter a name...' }).fill(name);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();

    const savedLink = page.getByRole('link', { name });
    await expect(savedLink).toBeVisible({ timeout: 20_000 });

    try {
      // Separate collections: the Recording page's own Saved searches never sees an Alert
      // entry, proving the two are not sharing storage.
      await gotoResilient(page, '/alerting/rules/recording');
      await page.getByRole('button', { name: 'Saved searches' }).click();
      await expect(page.getByRole('link', { name })).toHaveCount(0, { timeout: 20_000 });
      await page.keyboard.press('Escape');

      // Applying it from a fresh visit restores the search and its URL.
      await gotoResilient(page, '/alerting/rules/alert');
      await page.getByRole('button', { name: 'Saved searches' }).click();
      await page.getByRole('link', { name }).click();
      await expect(page).toHaveURL(/search=cpu/, { timeout: 20_000 });
      await expect(search).toHaveValue('cpu');
    } finally {
      await gotoResilient(page, '/alerting/rules/alert');
      await page.getByRole('button', { name: 'Saved searches' }).click();
      const listItem = page.getByRole('listitem').filter({ hasText: name });
      await listItem.getByRole('button', { name: 'Actions' }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await listItem.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('link', { name })).toHaveCount(0, { timeout: 20_000 });
    }
  });
});
