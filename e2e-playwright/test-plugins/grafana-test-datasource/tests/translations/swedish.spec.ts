import { SWEDISH_SWEDEN } from '@grafana/i18n';
import { expect, test } from '@grafana/plugin-e2e';
import pluginJson from '../../plugin.json';

// TODO remove this once newPreferencesPage is enabled by default
test.use({ userPreferences: { language: SWEDISH_SWEDEN } });

// mock out the k8s preferences (needed when newPreferencesPage is enabled)
test.beforeEach(async ({ page }) => {
  await page.route('**/apis/preferences.grafana.app/*/namespaces/*/preferences/merged', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.spec = { ...json.spec, language: SWEDISH_SWEDEN };
    await route.fulfill({ response, json });
  });
});

test('should display correct translation', async ({ createDataSourceConfigPage }) => {
  const configPage = await createDataSourceConfigPage({ type: pluginJson.id });

  await expect(configPage.ctx.page.getByLabel('API-nyckel')).toBeVisible();
});
