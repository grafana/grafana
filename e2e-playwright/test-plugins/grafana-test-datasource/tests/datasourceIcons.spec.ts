import { test, expect } from '@grafana/plugin-e2e';

import { expectAllIconsLoaded } from './utils';

test.describe('grafana-test-datasource', { tag: ['@plugins'] }, () => {
  test('all datasource type icons load in the add-new-datasource list', async ({ page }) => {
    await page.goto('/connections/datasources/new');

    // Each datasource type renders as a DataSourceTypeCard (literal class `card-parent`) with
    // its logo <img> inside.
    const cards = page.locator('.card-parent').filter({ has: page.locator('img') });
    await expect(cards.first()).toBeVisible();
    await expectAllIconsLoaded(cards, 1);
  });
});
