import { expect, test } from '@grafana/plugin-e2e';

import { prometheusLabels } from './mocks/resources';

test('variable query with mocked response', async ({ variableEditPage, page }) => {
  variableEditPage.mockQueryDataResponse(prometheusLabels);
  await variableEditPage.datasource.set('gdev-prometheus');
  await variableEditPage.getByTestIdOrAriaLabel('Query type').fill('Label names');
  await page.keyboard.press('Tab');
  await variableEditPage.runQuery();
  await expect(variableEditPage).toDisplayPreviews(prometheusLabels.data);
});
