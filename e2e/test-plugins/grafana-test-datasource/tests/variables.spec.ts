import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'grafana-test-datasource',
  {
    tag: ['@plugins'],
  },
  () => {
    test('should render variable editor', async ({ variableEditPage, page }) => {
      await variableEditPage.datasource.set('gdev-e2etestdatasource');
      await expect(page.getByRole('textbox', { name: 'Query Text' })).toBeVisible();
    });

    test('create new, successful variable query', async ({ variableEditPage, page }) => {
      await variableEditPage.datasource.set('gdev-e2etestdatasource');
      await page.getByRole('textbox', { name: 'Query Text' }).fill('variableQuery');
      await variableEditPage.runQuery();
      await expect(variableEditPage).toDisplayPreviews(['A', 'B']);
    });
  }
);
