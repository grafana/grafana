import { expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';

test.describe(
  'plugin-e2e-api-tests admin',
  {
    tag: ['@plugins'],
  },
  () => {
    test.describe('test createDataSourceConfigPage fixture, saveAndTest and toBeOK matcher', () => {
      test('invalid credentials should return an error', async ({ createDataSourceConfigPage, page }) => {
        const configPage = await createDataSourceConfigPage({ type: 'prometheus' });
        await page.getByPlaceholder('http://localhost:9090').fill('http://localhost:9090');
        await expect(
          configPage.saveAndTest(),
          formatExpectError('Expected save data source config to fail when Prometheus server is not running')
        ).not.toBeOK();
      });

      test('valid credentials should return a 200 status code', async ({ createDataSourceConfigPage, page }) => {
        const configPage = await createDataSourceConfigPage({ type: 'prometheus' });
        configPage.mockHealthCheckResponse({ status: 200 });
        await page.getByPlaceholder('http://localhost:9090').fill('http://localhost:9090');
        await expect(
          configPage.saveAndTest(),
          formatExpectError('Expected data source config to be successfully saved')
        ).toBeOK();
      });
    });
  }
);
