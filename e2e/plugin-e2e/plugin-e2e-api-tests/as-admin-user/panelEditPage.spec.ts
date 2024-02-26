import { DashboardPage, expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';
import { successfulDataQuery } from '../mocks/queries';
import { scenarios } from '../mocks/resources';

const PANEL_TITLE = 'Table panel E2E test';
const TABLE_VIZ_NAME = 'Table';
const STANDARD_OTIONS_CATEGORY = 'Standard options';
const DISPLAY_NAME_LABEL = 'Display name';

test.describe('query editor query data', () => {
  test('query data response should be OK when query is valid', async ({ panelEditPage }) => {
    await panelEditPage.datasource.set('gdev-testdata');
    await expect(
      panelEditPage.refreshPanel(),
      formatExpectError('Expected panel query to execute successfully')
    ).toBeOK();
  });

  test('query data response should not be OK and panel error should be displayed when query is invalid', async ({
    panelEditPage,
  }) => {
    await panelEditPage.datasource.set('gdev-testdata');
    const queryEditorRow = await panelEditPage.getQueryEditorRow('A');
    await queryEditorRow.getByLabel('Labels').fill('invalid-label-format');
    await expect(panelEditPage.refreshPanel(), formatExpectError('Expected panel query to fail')).not.toBeOK();
    await expect(
      panelEditPage.panel.getErrorIcon(),
      formatExpectError('Expected panel error to be displayed after query execution')
    ).toBeVisible();
  });
});

test.describe('query editor with mocked responses', () => {
  test('and resource `scenarios` is mocked', async ({ page, selectors, grafanaVersion, request }) => {
    const dashboardPage = new DashboardPage({ page, selectors, grafanaVersion, request });
    await dashboardPage.goto();
    await dashboardPage.mockResourceResponse('scenarios', scenarios);
    const panelEditPage = await dashboardPage.addPanel();
    await panelEditPage.datasource.set('gdev-testdata');
    const queryEditorRow = await panelEditPage.getQueryEditorRow('A');
    await queryEditorRow.getByLabel('Scenario').last().click();
    await expect(
      panelEditPage.getByTestIdOrAriaLabel(selectors.components.Select.option),
      formatExpectError('Expected certain select options to be displayed after clicking on the select input')
    ).toHaveText(scenarios.map((s) => s.name));
  });

  test('mocked query data response', async ({ panelEditPage, selectors }) => {
    await panelEditPage.mockQueryDataResponse(successfulDataQuery, 200);
    await panelEditPage.datasource.set('gdev-testdata');
    await panelEditPage.setVisualization(TABLE_VIZ_NAME);
    await panelEditPage.refreshPanel();
    await expect(
      panelEditPage.panel.getErrorIcon(),
      formatExpectError('Did not expect panel error to be displayed after query execution')
    ).not.toBeVisible();
    await expect(
      panelEditPage.getByTestIdOrAriaLabel(selectors.components.Panels.Visualization.Table.body),
      formatExpectError('Expected certain select options to be displayed after clicking on the select input')
    ).toHaveText('val1val2val3val4');
  });
});

test.describe('edit panel plugin settings', () => {
  test('change viz to table panel, set panel title and collapse section', async ({
    panelEditPage,
    selectors,
    page,
  }) => {
    await panelEditPage.setVisualization(TABLE_VIZ_NAME);
    await expect(
      panelEditPage.getByTestIdOrAriaLabel(selectors.components.PanelEditor.toggleVizPicker),
      formatExpectError('Expected panel visualization to be set to table')
    ).toHaveText(TABLE_VIZ_NAME);
    await panelEditPage.setPanelTitle(PANEL_TITLE);
    await expect(
      panelEditPage.getByTestIdOrAriaLabel(selectors.components.Panels.Panel.title(PANEL_TITLE)),
      formatExpectError('Expected panel title to be updated')
    ).toBeVisible();
    await panelEditPage.collapseSection(STANDARD_OTIONS_CATEGORY);
    await expect(
      page.getByText(DISPLAY_NAME_LABEL),
      formatExpectError('Expected section to be collapsed')
    ).toBeVisible();
  });
});
