import { test, expect } from '@grafana/plugin-e2e';

import { expectAllIconsLoaded } from '../utils';

// /connections/datasources/new (NewDataSource) loads from /api/plugins, which does NOT branch
// on plugins.useMTPlugins (there is no getDatasourcePluginMetas() call in app.ts yet). So this
// currently guards icon rendering on the classic path and becomes a true MT test once the
// page is wired to the meta API.
test.use({ openFeature: { flags: { 'plugins.useMTPlugins': true } } });

test.describe('grafana-test-datasource', { tag: ['@plugins', '@plugins.useMTPlugins'] }, () => {
  test('all datasource type icons load in the add-new-datasource list', async ({ page }) => {
    await page.goto('/connections/datasources/new');

    // Each datasource type renders as a DataSourceTypeCard (literal class `card-parent`) with
    // its logo <img> inside.
    const cards = page.locator('.card-parent').filter({ has: page.locator('img') });
    await expect(cards.first()).toBeVisible();
    await expectAllIconsLoaded(cards, 1);
  });
});
