import { expect, test } from '@grafana/plugin-e2e';

test.describe('test createDataSourceConfigPage fixture, saveAndTest and toBeOK matcher', () => {
  test('invalid credentials should return an error', async ({ createDataSourceConfigPage, page }) => {
    const configPage = await createDataSourceConfigPage({ type: 'prometheus' });
    await page.getByPlaceholder('http://localhost:9090').fill('http://localhost:9090');
    await expect(configPage.saveAndTest()).not.toBeOK();
  });

  test('valid credentials should return a 200 status code', async ({ createDataSourceConfigPage, page }) => {
    const configPage = await createDataSourceConfigPage({ type: 'prometheus' });
    configPage.mockHealthCheckResponse({ status: 200 });
    await page.getByPlaceholder('http://localhost:9090').fill('http://localhost:9090');
    await expect(configPage.saveAndTest()).toBeOK();
  });
});

test.describe('test data source with frontend only health check', () => {
  test('valid credentials should display a success alert on the page', async ({ createDataSourceConfigPage }) => {
    const configPage = await createDataSourceConfigPage({ type: 'testdata' });
    await configPage.saveAndTest({ skipWaitForResponse: true });
    await expect(configPage).toHaveAlert('success', { hasNotText: 'Datasource updated' });
  });
});
