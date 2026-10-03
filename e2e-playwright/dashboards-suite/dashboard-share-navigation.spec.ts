import { expect } from '@grafana/plugin-e2e';

import { test, openShare } from './utils/dashboard-lazy-loading';

// Share chunk cancellation and retry coverage needs the URL-sync lazy-loading follow-up.
test(
  'share supports deep links, reload, close, and browser history',
  { tag: '@behavior' },
  async ({ page, dashboardPath }) => {
    await page.goto(`${dashboardPath}?shareView=link`);
    await expect(page.getByRole('button', { name: 'Copy link', exact: true }).last()).toBeVisible();
    await expect(page.getByText('Shorten link', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Shorten link', { exact: true })).toBeVisible();
    await page.getByTestId('data-testid Drawer close').click();
    await expect(page.getByText('Browser review content')).toBeVisible();
    await expect(page).not.toHaveURL(/shareView=/);

    await page.goto(dashboardPath);
    await openShare(page);
    const view = page.getByText('Shorten link', { exact: true });
    await expect(view).toBeVisible();
    await expect(page).toHaveURL(/shareView=/);
    await page.goBack();
    await expect(page.getByText('Browser review content')).toBeVisible();
    await expect(view).toBeHidden();
    await expect(page).not.toHaveURL(/shareView=/);
    await page.goForward();
    await expect(view).toBeVisible();
    await expect(page).toHaveURL(/shareView=/);
  }
);
