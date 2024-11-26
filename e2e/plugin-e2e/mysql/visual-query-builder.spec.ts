import { selectors } from '@grafana/e2e-selectors';
import { test, expect } from '@grafana/plugin-e2e';

import { normalTableName } from './mocks/mysql.mocks';
import { mockDataSourceRequest } from './utils';

test.beforeEach(mockDataSourceRequest);

test.use({ featureToggles: { sqlQuerybuilderFunctionParameters: true } });

test('visual query builder should handle macros', async ({ explorePage, page }) => {
  await explorePage.getByGrafanaSelector(selectors.components.SQLQueryEditor.headerTableSelector).click();
  await page.getByText(normalTableName, { exact: true }).click();

  // Open Data operations
  await explorePage.getByGrafanaSelector(selectors.components.SQLQueryEditor.selectAggregation).click();
  const select = page.getByLabel('Select options menu');
  await select.locator(page.getByText('$__timeGroupAlias')).click();

  // Open column selector
  await explorePage.getByGrafanaSelector(selectors.components.SQLQueryEditor.selectFunctionParameter('Column')).click();
  await select.locator(page.getByText('createdAt')).click();

  // Open Interval selector
  await explorePage
    .getByGrafanaSelector(selectors.components.SQLQueryEditor.selectFunctionParameter('Interval'))
    .click();
  await select.locator(page.getByText('$__interval')).click();

  await page.getByRole('button', { name: 'Add column' }).click();

  await explorePage.getByGrafanaSelector(selectors.components.SQLQueryEditor.selectAggregation).nth(1).click();
  await select.locator(page.getByText('AVG')).click();

  await explorePage
    .getByGrafanaSelector(selectors.components.SQLQueryEditor.selectFunctionParameter('Column'))
    .nth(1)
    .click();
  await select.locator(page.getByText('bigint')).click();

  // Validate the query
  await expect(
    explorePage.getByGrafanaSelector(selectors.components.CodeEditor.container).getByRole('textbox')
  ).toHaveValue(
    `SELECT\n  $__timeGroupAlias(createdAt, $__interval),\n  AVG(\`bigint\`)\nFROM\n  DataMaker.normalTable\nLIMIT\n  50`
  );
});
