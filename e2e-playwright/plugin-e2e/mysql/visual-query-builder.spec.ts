import { type Page } from 'playwright-core';

import { selectors } from '@grafana/e2e-selectors';
import { test, expect } from '@grafana/plugin-e2e';

import { normalTableName } from './mocks/mysql.mocks';
import { mockDataSourceRequest } from './utils';

test.beforeEach(mockDataSourceRequest);

async function getExecutedRawSql(page: Page) {
  const request = page.waitForRequest(/\/api\/ds\/query/);
  await page.getByRole('button', { name: 'Run query' }).last().click();
  return (await request).postDataJSON().queries[0].rawSql;
}

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

      await expect(getExecutedRawSql(page)).resolves.toBe(
        'SELECT $__timeGroupAlias(createdAt,1m), AVG(`bigint`) FROM grafana.normalTable LIMIT 50 '
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
      await page.getByRole('switch', { name: 'Filter' }).last().click({ force: true });

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

      await expect(getExecutedRawSql(page)).resolves.toBe(
        'SELECT createdAt FROM grafana.normalTable WHERE $__timeFilter(createdAt) LIMIT 50 '
      );

      // Validate that the timeFilter macro was removed when changed to equals operator
      await explorePage.getByGrafanaSelector(selectors.components.SQLQueryEditor.filterOperator).click();
      await select.locator(page.getByText('==')).click();

      await explorePage.getByGrafanaSelector(selectors.components.DateTimePicker.input).click();
      await explorePage.getByGrafanaSelector(selectors.components.DateTimePicker.input).blur();

      await expect(getExecutedRawSql(page)).resolves.toMatch(
        /^SELECT createdAt FROM grafana\.normalTable WHERE createdAt = '\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}' LIMIT 50 $/
      );
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

      await expect(getExecutedRawSql(page)).resolves.toBe(
        "SELECT * FROM grafana.normalTable WHERE name IN ('a') LIMIT 50 "
      );
    });
  }
);
