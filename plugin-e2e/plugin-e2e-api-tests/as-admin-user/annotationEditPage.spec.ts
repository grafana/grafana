import { expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';
import { successfulAnnotationQuery } from '../mocks/queries';

test('annotation query data with mocked response', async ({ annotationEditPage, page, readProvisionedDataSource }) => {
  const ds = await readProvisionedDataSource({ name: 'gdev-testdata', fileName: 'dev.yaml' });
  annotationEditPage.mockQueryDataResponse(successfulAnnotationQuery);
  await annotationEditPage.datasource.set(ds.name);
  await page.getByLabel('Scenario').last().fill('CSV Content');
  await page.keyboard.press('Tab');
  await expect(
    annotationEditPage.runQuery(),
    formatExpectError('Expected annotation query to execute successfully')
  ).toBeOK();
});
