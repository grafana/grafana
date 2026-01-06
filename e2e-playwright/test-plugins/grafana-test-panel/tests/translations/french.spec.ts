import { FRENCH_FRANCE } from '@grafana/i18n';
import { expect, test } from '@grafana/plugin-e2e';

test.use({ userPreferences: { language: FRENCH_FRANCE } });

test('should display default translation (en-US)', async ({ panelEditPage }) => {
  panelEditPage.setVisualization('Grafana E2ETest Panel');

  await expect(panelEditPage.panel.locator.getByText('Text option value:')).toBeVisible();
  const options = panelEditPage.getCustomOptions('Grafana E2ETest Panel');
  const showSeriesCounter = options.getSwitch('Show series counter');
  await expect(showSeriesCounter.locator()).toBeVisible();
});
