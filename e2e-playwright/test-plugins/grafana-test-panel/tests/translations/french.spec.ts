import { FRENCH_FRANCE } from '@grafana/i18n';
import { expect, test } from '@grafana/plugin-e2e';

// TODO remove this once the newPreferencesPage flag is removed
test.use({ userPreferences: { language: FRENCH_FRANCE } });

// mock out the k8s preferences (needed when newPreferencesPage is enabled)
test.beforeEach(async ({ page }) => {
  await page.route('**/apis/preferences.grafana.app/*/namespaces/*/preferences/merged', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.spec = { ...json.spec, language: FRENCH_FRANCE };
    await route.fulfill({ response, json });
  });
});

test('should display default translation (en-US)', async ({ panelEditPage }) => {
  panelEditPage.setVisualization('Grafana E2ETest Panel');

  await expect(panelEditPage.panel.locator.getByText('Text option value:')).toBeVisible();
  const options = panelEditPage.getCustomOptions('Grafana E2ETest Panel');
  const showSeriesCounter = options.getSwitch('Show series counter');
  await expect(showSeriesCounter.locator()).toBeVisible();
});
