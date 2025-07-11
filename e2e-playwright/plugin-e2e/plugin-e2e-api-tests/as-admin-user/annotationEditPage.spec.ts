import { expect, test } from '@grafana/plugin-e2e';
import { AlertVariant } from '@grafana/ui';

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
  severity: AlertVariant;
  status: number;
}

const scenarios: Scenario[] = [
  { name: 'error', severity: 'error', mock: failedAnnotationQuery, text: 'Google API Error 400', status: 400 },
  {
    name: 'multiple errors',
    severity: 'error',
    mock: failedAnnotationQueryWithMultipleErrors,
    text: 'Google API Error 400Google API Error 401',
    status: 400,
  },
  {
    name: 'data',
    severity: 'success',
    mock: successfulAnnotationQueryWithData,
    text: '2 events (from 2 fields)',
    status: 200,
  },
  {
    name: 'empty result',
    severity: 'warning',
    mock: successfulAnnotationQueryWithoutData,
    text: 'No events found',
    status: 200,
  },
];

test.describe('plugin-e2e-api-tests admin', { tag: ['@plugins'] }, () => {
  for (const scenario of scenarios) {
    test(`annotation query data with ${scenario.name}`, async ({ annotationEditPage, page }) => {
      annotationEditPage.mockQueryDataResponse(scenario.mock, scenario.status);
      await annotationEditPage.datasource.set('gdev-testdata');
      await page.getByLabel('Scenario').last().fill('CSV Content');
      await page.keyboard.press('Tab');
      await annotationEditPage.runQuery();
      await expect(annotationEditPage).toHaveAlert(scenario.severity, { hasText: scenario.text });
    });
  }
});
