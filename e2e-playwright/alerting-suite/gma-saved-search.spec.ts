import { test, expect } from '@grafana/plugin-e2e';

import { newAdminRequest } from './ruleSeeding';
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

  // A default saved search applies to every visit that has no query, so setting one for the shared
  // Admin user would filter the pages other parallel tests open. The journey runs as its own user
  // instead, created and removed here.
  for (const kind of ['alert', 'recording'] as const) {
    test(`SAVE-3 (${kind}): the default saved search applies when the page opens with no search and not when the URL has one`, async ({
      browser,
      playwright,
    }, testInfo) => {
      const baseURL = testInfo.project.use.baseURL as string;
      const suffix = crypto.randomUUID().slice(0, 8);
      const login = `saved-search-${kind}-${suffix}`;
      const password = `pw-${suffix}-Aa1`;
      const name = `Latency ${kind} rules ${suffix}`;
      const path = `/alerting/rules/${kind}`;

      const admin = await newAdminRequest(playwright, baseURL);
      const created = await admin.post('/api/admin/users', {
        data: { name: login, email: `${login}@example.com`, login, password },
      });
      expect(created.ok(), `create user -> ${created.status()} ${await created.text()}`).toBeTruthy();
      const userId = (await created.json()).id;

      const context = await browser.newContext({ baseURL });
      try {
        const loggedIn = await context.request.post('/login', { data: { user: login, password } });
        expect(loggedIn.ok(), `log in -> ${loggedIn.status()}`).toBeTruthy();
        const page = await context.newPage();

        await gotoResilient(page, `${path}?search=latency`);
        const dialog = page.getByRole('dialog', { name: 'Saved searches' });
        await page.getByRole('button', { name: 'Saved searches' }).click();
        await dialog.getByRole('button', { name: 'Save current search' }).click();
        await dialog.getByRole('textbox', { name: 'Enter a name...' }).fill(name);
        await dialog.getByRole('button', { name: 'Save', exact: true }).click();
        const savedItem = dialog.getByRole('listitem').filter({ hasText: name });
        await expect(savedItem).toBeVisible({ timeout: 20_000 });
        await savedItem.getByRole('button', { name: 'Actions' }).click();
        await page.getByRole('menuitem', { name: /set as default/i }).click();
        await expect(dialog.getByRole('img', { name: /default search/i })).toBeVisible({ timeout: 20_000 });

        // A visit with no query lands on the default search.
        await gotoResilient(page, path);
        const search = page.getByRole('textbox', { name: /^search/i });
        await expect(search).toHaveValue('latency', { timeout: 20_000 });
        await expect(page).toHaveURL(/search=latency/);

        // A visit with its own query keeps it. The saved search only shows once its collection has
        // loaded, which is when the default would have been applied.
        await gotoResilient(page, `${path}?search=cpu`);
        await page.getByRole('button', { name: 'Saved searches' }).click();
        await expect(page.getByRole('link', { name })).toBeVisible({ timeout: 20_000 });
        await expect(page).toHaveURL(/search=cpu/);
        await expect(search).toHaveValue('cpu');
      } finally {
        await context.close();
        await admin.delete(`/api/admin/users/${userId}`);
        await admin.dispose();
      }
    });
  }
});
