import { SWEDISH_SWEDEN } from '@grafana/i18n';
import { expect, test } from '@grafana/plugin-e2e';

test.use({ userPreferences: { language: SWEDISH_SWEDEN } });

test('should display correct translation', async ({ panelEditPage }) => {
  panelEditPage.setVisualization('Grafana E2ETest Panel');

  await expect(panelEditPage.panel.locator.getByText('Textalternativ värde:')).toBeVisible();
  const options = panelEditPage.getCustomOptions('Grafana E2ETest Panel');
  const showSeriesCounter = options.getSwitch('Visa serieräknare');
  await expect(showSeriesCounter.locator()).toBeVisible();
});
