import { SWEDISH_SWEDEN } from '@grafana/i18n';
import { expect, test } from '@grafana/plugin-e2e';

// TODO remove this once newPreferencesPage flag is removed
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

test('should display correct translation', async ({ panelEditPage }) => {
  await panelEditPage.setVisualization('Grafana E2ETest Panel');

  await expect(panelEditPage.panel.locator.getByText('Textalternativ värde:')).toBeVisible();
  const options = panelEditPage.getCustomOptions('Grafana E2ETest Panel');
  const showSeriesCounter = options.getSwitch('Visa serieräknare');
  await expect(showSeriesCounter.locator()).toBeVisible();
});
