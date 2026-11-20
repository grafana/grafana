import { test, expect } from '@grafana/plugin-e2e';

import { ITERATIONS, measure, setupPerf } from './perf';

const unique = () => crypto.randomUUID().slice(0, 8);

test.describe('Perf: users and teams', { tag: ['@perf'] }, () => {
  test('users: list, search, create and edit', async ({ page, request }, testInfo) => {
    const cdp = await setupPerf(page);
    const logins: string[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      await measure(page, cdp, testInfo, 'users: load list', async () => {
        await page.goto('/admin/users');
        await page.getByRole('row').nth(1).waitFor();
      });

      await measure(page, cdp, testInfo, 'users: search list', async () => {
        await page.getByPlaceholder('Search user by login, email, or name.').pressSequentially('admin', { delay: 0 });
      });

      const login = `perf-user-${unique()}`;
      logins.push(login);
      await measure(page, cdp, testInfo, 'users: create user', async () => {
        await page.goto('/admin/users/create');
        await page.locator('#name-input').fill(`Perf User ${login}`);
        await page.locator('#email-input').fill(`${login}@example.com`);
        await page.locator('#username-input').fill(login);
        await page.locator('#password-input').fill('perf-password');
        await page.getByRole('button', { name: 'Create user' }).click();
        await page.waitForURL(/\/admin\/users\/edit\//);
        await page.getByRole('button', { name: 'Edit' }).first().waitFor();
      });

      await measure(page, cdp, testInfo, 'users: edit name', async () => {
        await page.getByRole('row', { name: /^Name/ }).getByRole('button', { name: 'Edit' }).click();
        const input = page.locator('#Name-input');
        await input.fill('');
        await input.pressSequentially(`Renamed ${login}`, { delay: 0 });
        await page.getByRole('row', { name: /^Name/ }).getByRole('button', { name: 'Save' }).click();
        await expect(page.getByRole('row', { name: /^Name/ })).toContainText(`Renamed ${login}`);
      });
    }

    for (const login of logins) {
      const user = await request.get(`/api/users/lookup?loginOrEmail=${login}`);
      if (user.ok()) {
        await request.delete(`/api/admin/users/${(await user.json()).id}`);
      }
    }
  });

  test('teams: list, search, create and edit', async ({ page, request }, testInfo) => {
    const cdp = await setupPerf(page);
    const names: string[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const name = `Platform team ${unique()}`;
      names.push(name);

      await measure(page, cdp, testInfo, 'teams: create team', async () => {
        await page.goto('/org/teams/new');
        await page.getByRole('textbox', { name: 'Name' }).fill(name);
        await page.getByRole('button', { name: 'Create', exact: true }).click();
        await page.getByText('Team created successfully.').waitFor();
      });

      // The success alert links to the new team; its settings tab sits beside that page.
      const detailsUrl = await page.getByRole('link', { name: 'Open team details' }).getAttribute('href');
      const settingsUrl = `${detailsUrl!.replace(/\/(members|settings)$/, '')}/settings`;
      await measure(page, cdp, testInfo, 'teams: edit settings', async () => {
        await page.goto(settingsUrl);
        const nameInput = page.getByRole('textbox', { name: 'Name' });
        await expect(nameInput).toHaveValue(name);
        await nameInput.fill('');
        await nameInput.pressSequentially(`${name} renamed`, { delay: 0 });
        const saved = page.waitForResponse((r) => r.url().includes('/api/teams/') && r.request().method() === 'PUT');
        await page.getByRole('button', { name: 'Save team details' }).click();
        await saved;
      });
      names[names.length - 1] = `${name} renamed`;

      await measure(page, cdp, testInfo, 'teams: load list', async () => {
        await page.goto('/org/teams');
        await page
          .getByRole('link', { name: `${name} renamed` })
          .first()
          .waitFor();
      });

      await measure(page, cdp, testInfo, 'teams: search list', async () => {
        await page.getByPlaceholder('Search teams').pressSequentially('Platform', { delay: 0 });
      });
    }

    for (const name of names) {
      const res = await request.get(`/api/teams/search?query=${encodeURIComponent(name)}`);
      for (const team of res.ok() ? (await res.json()).teams : []) {
        await request.delete(`/api/teams/${team.id}`);
      }
    }
  });
});
