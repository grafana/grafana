import { test, expect } from '@grafana/plugin-e2e';

import { gotoResilient } from './waitForAppLoad';

test.describe('Navigation', () => {
  // See gma-stack-gate-and-old-link.spec.ts for why: this dev instance's rspack watcher
  // rebuilds on every concurrently-running agent's file change.
  test.slow();

  test('NAV-2: Alert rules and Recording rules are separate main-menu entries, each with its own tabs', async ({
    page,
  }) => {
    await gotoResilient(page, '/alerting/rules/alert');

    const nav = page.getByRole('navigation', { name: 'Navigation' });
    await expect(nav.getByRole('link', { name: 'Alert rules' })).toHaveAttribute('href', '/alerting/rules/alert', {
      timeout: 40_000,
    });
    await expect(nav.getByRole('link', { name: 'Recording rules' })).toHaveAttribute(
      'href',
      '/alerting/rules/recording'
    );
    // No leftover combined-list or evaluation-group entry in the new experience.
    await expect(nav.getByRole('link', { name: 'Alert rules', exact: true })).toHaveCount(1);

    await expect(page.getByRole('tab', { name: 'Alert rules' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Recently deleted' })).toHaveAttribute('aria-selected', 'false');

    await page.getByRole('tab', { name: 'Recently deleted' }).click();
    await expect(page).toHaveURL(/\/alerting\/rules\/alert\/deleted/, { timeout: 40_000 });

    await gotoResilient(page, '/alerting/rules/recording');
    await expect(page.getByRole('tab', { name: 'Recording rules' })).toHaveAttribute('aria-selected', 'true', {
      timeout: 40_000,
    });

    await page.getByRole('tab', { name: 'Recently deleted' }).click();
    await expect(page).toHaveURL(/\/alerting\/rules\/recording\/deleted/, { timeout: 40_000 });
  });
});
