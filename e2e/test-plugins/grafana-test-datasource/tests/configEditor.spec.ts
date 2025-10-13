import { test, expect, DataSourceConfigPage } from '@grafana/plugin-e2e';

// The following tests verify that label and input field association is working correctly.
// If these tests break, e2e tests in external plugins will break too.

test.describe('config editor ', () => {
  let configPage: DataSourceConfigPage;
  test.beforeEach(async ({ createDataSourceConfigPage }) => {
    configPage = await createDataSourceConfigPage({ type: 'grafana-e2etest-datasource' });
  });

  test('text input field', async ({ page }) => {
    const field = page.getByRole('textbox', { name: 'API key' });
    await expect(field).toBeEmpty();
    await field.fill('test text');
    await expect(field).toHaveValue('test text');
  });

  test('switch field', async ({ page }) => {
    const field = page.getByLabel('Switch Enabled');
    await expect(field).not.toBeChecked();
    await field.check();
    await expect(field).toBeChecked();
  });

  test('checkbox field', async ({ page }) => {
    const field = page.getByRole('checkbox', { name: 'Checkbox Enabled' });
    await expect(field).not.toBeChecked();
    await field.check({ force: true });
    await expect(field).toBeChecked();
  });

  test('select field', async ({ page, selectors }) => {
    const field = page.getByRole('combobox', { name: 'Auth type' });
    await field.click();
    const option = selectors.components.Select.option;
    await expect(configPage.getByGrafanaSelector(option)).toHaveText(['keys', 'credentials']);
  });
});
