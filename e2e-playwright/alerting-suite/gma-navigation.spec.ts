import { test, expect } from '@grafana/plugin-e2e';

test.describe('Navigation', () => {
  test('NAV-2: Alert rules and Recording rules are separate main-menu entries, each with its own tabs', async ({
    page,
  }) => {
    await page.goto('/alerting/rules/alert');

    const nav = page.getByRole('navigation', { name: 'Navigation' });
    await expect(nav.getByRole('link', { name: 'Alert rules' })).toHaveAttribute('href', '/alerting/rules/alert');
    await expect(nav.getByRole('link', { name: 'Recording rules' })).toHaveAttribute(
      'href',
      '/alerting/rules/recording'
    );
    // No leftover combined-list or evaluation-group entry in the new experience.
    await expect(nav.getByRole('link', { name: 'Alert rules', exact: true })).toHaveCount(1);

    await expect(page.getByRole('tab', { name: 'Alert rules' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Recently deleted' })).toHaveAttribute('aria-selected', 'false');

    await page.getByRole('tab', { name: 'Recently deleted' }).click();
    await expect(page).toHaveURL(/\/alerting\/rules\/alert\/deleted/);

    await page.goto('/alerting/rules/recording');
    await expect(page.getByRole('tab', { name: 'Recording rules' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'Recently deleted' }).click();
    await expect(page).toHaveURL(/\/alerting\/rules\/recording\/deleted/);
  });
});
