import { selectors } from '@grafana/e2e-selectors';
import { expect, test } from '@grafana/plugin-e2e';

import {
  successfulAnnotationQueryWithData,
  failedAnnotationQueryWithMultipleErrors,
  successfulAnnotationQueryWithoutData,
  failedAnnotationQuery,
} from '../mocks/queries';

interface Scenario {
  name: string;
  mock: object;
  text: string;
  status: number;
}

const scenarios: Scenario[] = [
  { name: 'error', mock: failedAnnotationQuery, text: 'Google API Error 400', status: 400 },
  {
    name: 'multiple errors',
    mock: failedAnnotationQueryWithMultipleErrors,
    text: 'Google API Error 400Google API Error 401',
    status: 400,
  },
  { name: 'data', mock: successfulAnnotationQueryWithData, text: '2 events (from 2 fields)', status: 200 },
  { name: 'empty result', mock: successfulAnnotationQueryWithoutData, text: 'No events found', status: 200 },
];

for (const scenario of scenarios) {
  test(`annotation query data with ${scenario.name}`, async ({ annotationEditPage, page }) => {
    annotationEditPage.mockQueryDataResponse(scenario.mock, scenario.status);
    const resultContainerSelector = selectors.components.Annotations.editor.resultContainer;
    await annotationEditPage.datasource.set('gdev-testdata');
    await page.getByLabel('Scenario').last().fill('CSV Content');
    await page.keyboard.press('Tab');
    await annotationEditPage.runQuery();
    await expect(annotationEditPage.getByTestIdOrAriaLabel(resultContainerSelector)).toContainText(scenario.text);
  });
}
