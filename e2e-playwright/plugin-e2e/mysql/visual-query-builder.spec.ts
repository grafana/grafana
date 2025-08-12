import { selectors } from '@grafana/e2e-selectors';
import { test, expect } from '@grafana/plugin-e2e';

import { normalTableName } from './mocks/mysql.mocks';
import { mockDataSourceRequest } from './utils';

test.beforeEach(mockDataSourceRequest);

test.describe(
  'mysql',
  {
    tag: '@plugins',
  },
  () => {
    test('visual query builder should handle macros', async ({ explorePage, page }) => {
      await explorePage.getByGrafanaSelector(selectors.components.SQLQueryEditor.headerTableSelector).click();
      await page.getByText(normalTableName, { exact: true }).click();

      // Open Data operations
      await explorePage.getByGrafanaSelector(selectors.components.SQLQueryEditor.selectAggregation).click();
      const select = page.getByLabel('Select options menu');
      await select.locator(page.getByText('$__timeGroupAlias')).click();

      // Open column selector
      await explorePage
        .getByGrafanaSelector(selectors.components.SQLQueryEditor.selectFunctionParameter('Column'))
        .click();
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
        `SELECT\n  $__timeGroupAlias(createdAt, $__interval),\n  AVG(\`bigint\`)\nFROM\n  grafana.normalTable\nLIMIT\n  50`
      );
    });

    test('visual query builder should handle time filter macro', async ({ explorePage, page }) => {
      await explorePage.getByGrafanaSelector(selectors.components.SQLQueryEditor.headerTableSelector).click();
      await page.getByText(normalTableName, { exact: true }).click();

      // Open column selector
      await explorePage.getByGrafanaSelector(selectors.components.SQLQueryEditor.selectColumn).click();
      const select = page.getByLabel('Select options menu');
      await select.locator(page.getByText('createdAt')).click();

      // Toggle where row
      await page.getByLabel('Filter').last().click();

      // Click add filter button
      await page.getByRole('button', { name: 'Add filter' }).click();
      await page.getByRole('button', { name: 'Add filter' }).click(); // For some reason we need to click twice

      // Open field selector
      await explorePage.getByGrafanaSelector(selectors.components.SQLQueryEditor.filterField).click();
      await select.locator(page.getByText('createdAt')).click();

      // Open operator selector
      await explorePage.getByGrafanaSelector(selectors.components.SQLQueryEditor.filterOperator).click();
      await select.locator(page.getByText('Macros')).click();

      // Open macros value selector
      await explorePage.getByGrafanaSelector('Macros value selector').click();
      await select.locator(page.getByText('timeFilter', { exact: true })).click();

      // Validate that the timeFilter macro was added
      await expect(
        explorePage.getByGrafanaSelector(selectors.components.CodeEditor.container).getByRole('textbox')
      ).toHaveValue(`SELECT\n  createdAt\nFROM\n  grafana.normalTable\nWHERE\n  $__timeFilter(createdAt)\nLIMIT\n  50`);

      // Validate that the timeFilter macro was removed when changed to equals operator
      await explorePage.getByGrafanaSelector(selectors.components.SQLQueryEditor.filterOperator).click();
      await select.locator(page.getByText('==')).click();

      await explorePage.getByGrafanaSelector(selectors.components.DateTimePicker.input).click();
      await explorePage.getByGrafanaSelector(selectors.components.DateTimePicker.input).blur();

      await expect(
        explorePage.getByGrafanaSelector(selectors.components.CodeEditor.container).getByRole('textbox')
      ).not.toHaveValue(`SELECT\n  createdAt\nFROM\n  grafana.normalTable\nWHERE\n  createdAt = NULL\nLIMIT\n  50`);
    });

    test('visual query builder should not crash when filter is set to select_any_in', async ({ explorePage, page }) => {
      const queryParams = new URLSearchParams();
      queryParams.set('schemaVersion', '1');
      queryParams.set('orgId', '1');
      const panes = {
        mmm: {
          datasource: 'P4FDCC188E688367F',
          queries: [
            {
              refId: 'A',
              datasource: {
                type: 'mysql',
                uid: 'P4FDCC188E688367F',
              },
              format: 'table',
              rawSql: "SELECT * FROM grafana.normalTable WHERE name IN ('a') LIMIT 50 ",
              editorMode: 'builder',
              sql: {
                columns: [
                  {
                    type: 'function',
                    parameters: [
                      {
                        type: 'functionParameter',
                        name: '*',
                      },
                    ],
                  },
                ],
                groupBy: [
                  {
                    type: 'groupBy',
                    property: {
                      type: 'string',
                    },
                  },
                ],
                limit: 50,
                whereJsonTree: {
                  id: 'baa99aa9-0123-4456-b89a-b195d1dcfc6a',
                  type: 'group',
                  children1: [
                    {
                      type: 'rule',
                      id: 'bb9a8bba-89ab-4cde-b012-3195d1dd2c91',
                      properties: {
                        fieldSrc: 'field',
                        field: 'name',
                        operator: 'select_any_in',
                        value: ['a'],
                        valueSrc: ['value'],
                        valueType: ['text'],
                      },
                    },
                  ],
                },
                whereString: "name IN ('a')",
              },
              dataset: 'grafana',
              table: 'normalTable',
            },
          ],
        },
      };
      queryParams.set('panes', JSON.stringify(panes));

      await explorePage.goto({ queryParams });

      // Validate the query
      await expect(
        explorePage.getByGrafanaSelector(selectors.components.CodeEditor.container).getByRole('textbox')
      ).toHaveValue(`SELECT\n  *\nFROM\n  grafana.normalTable\nWHERE\n  name IN ('a')\nLIMIT\n  50`);
    });
  }
);
