import { expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';
import { prometheusLabels } from '../mocks/resources';

test('variable query with mocked response', async ({ variableEditPage, page }) => {
  variableEditPage.mockResourceResponse('api/v1/labels?*', prometheusLabels);
  await variableEditPage.datasource.set('gdev-prometheus');
  await variableEditPage.getByTestIdOrAriaLabel('Query type').fill('Label names');
  await page.keyboard.press('Tab');
  await variableEditPage.runQuery();
  await expect(
    variableEditPage,
    formatExpectError('Expected variable edit page to display certain label names after query execution')
  ).toDisplayPreviews(prometheusLabels.data);
});
