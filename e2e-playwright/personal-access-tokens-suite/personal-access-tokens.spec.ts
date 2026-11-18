import { test, expect } from '@grafana/plugin-e2e';

// Requires GF_FEATURE_TOGGLES_ENABLE=personalAccessTokens and GF_PERSONAL_ACCESS_TOKENS_ENABLED=true.
test.describe(
  'Personal access tokens',
  {
    tag: ['@various'],
  },
  () => {
    test.describe.configure({ mode: 'serial' });

    const tokenName = `e2e-token-${Date.now()}`;

    test('creates a token, shows the secret once and revokes it', async ({ page }) => {
      await page.goto('/profile/personal-access-tokens');

      await page.getByRole('button', { name: 'Add token' }).click();
      await page.getByLabel('Display name').fill(tokenName);
      await page.getByRole('radio', { name: 'Read only' }).check({ force: true });
      await page.getByRole('dialog').getByRole('button', { name: 'Generate token' }).click();

      const secret = await page.getByLabel('Token', { exact: true }).inputValue();
      expect(secret).toMatch(/^glpat_/);
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click();

      const row = page.getByRole('row', { name: new RegExp(tokenName) });
      await expect(row).toBeVisible();
      await expect(page.getByText(secret)).toHaveCount(0);

      await row.getByRole('button', { name: `Revoke token ${tokenName}` }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Revoke', exact: true }).click();
      await expect(page.getByRole('row', { name: new RegExp(tokenName) })).toHaveCount(0);
    });

    test('admin table sorts when a column header is clicked', async ({ page }) => {
      await page.goto('/admin/personal-access-tokens');
      const table = page.getByRole('table', { name: 'Personal access tokens' });
      await expect(table).toBeVisible();

      const header = table.getByRole('columnheader', { name: /Name/ });
      await header.getByRole('button').click();
      await expect(header).toHaveAttribute('aria-sort', /ascending|descending/);
    });

    test('profile page hides token creation when the instance policy is off', async ({ page, request }) => {
      const url = '/api/admin/settings/personal-access-tokens';
      try {
        const off = await request.put(url, { data: { enabled: false, revokeExisting: false } });
        expect(off.ok()).toBeTruthy();

        await page.goto('/profile/personal-access-tokens');
        await expect(page.getByText('Personal access tokens are disabled by your administrator')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add token' })).toBeDisabled();
      } finally {
        await request.put(url, { data: { enabled: true, revokeExisting: false } });
      }
    });
  }
);
