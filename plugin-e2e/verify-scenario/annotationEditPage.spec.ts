import { expect, test } from '@grafana/plugin-e2e';

import { successfullAnnotationQuery } from './mocks/queries';

test('annotation query data with mocked response', async ({ annotationEditPage, page }) => {
  annotationEditPage.mockQueryDataResponse(successfullAnnotationQuery);
  await annotationEditPage.datasource.set('gdev-testdata');
  await page.getByLabel('Scenario').last().fill('CSV Content');
  await page.keyboard.press('Tab');
  await expect(annotationEditPage.runQuery()).toBeOK();
});
