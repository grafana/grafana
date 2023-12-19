import { expect, test } from '@grafana/plugin-e2e';

import { successfullAnnotationQuery } from './mocks/queries';

test('annotation query data with mocked response', async ({ annotationEditPage }) => {
  annotationEditPage.mockQueryDataResponse(successfullAnnotationQuery);
  await annotationEditPage.datasource.set('gdev-testdata');
  await expect(annotationEditPage.runQuery()).toBeOK();
});
