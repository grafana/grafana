import { expect, test } from '@grafana/plugin-e2e';

import { successfulDataQuery } from './mocks/queries';
import { scenarios } from './mocks/resources';

test.describe('query editor query data', () => {
  test('query data response should be OK when query is valid', async ({ panelEditPage }) => {
    await panelEditPage.datasource.set('gdev-testdata');
    await expect(panelEditPage.refreshPanel()).toBeOK();
  });

  test('query data response should not be OK when query is invalid', async ({ panelEditPage, page }) => {
    await panelEditPage.datasource.set('gdev-testdata');
    const queryEditorRow = await panelEditPage.getQueryEditorRow('A');
    await queryEditorRow.getByLabel('Labels').fill('invalid-label-format');
    await expect(panelEditPage.refreshPanel()).not.toBeOK();
    await expect(panelEditPage).toHavePanelError();
  });
});

test.describe('query editor with mocked responses', () => {
  test('mocked scenarios', async ({ panelEditPage, selectors }) => {
    await panelEditPage.mockResourceResponse('scenarios', scenarios);
    await panelEditPage.datasource.set('gdev-testdata');
    const queryEditorRow = await panelEditPage.getQueryEditorRow('A');
    await queryEditorRow.getByLabel('Scenario').last().click();
    await expect(panelEditPage.getByTestIdOrAriaLabel(selectors.components.Select.option)).toHaveText(
      scenarios.map((s) => s.name)
    );
  });

  test('mocked query data response', async ({ panelEditPage, page, selectors }) => {
    await panelEditPage.mockQueryDataResponse(successfulDataQuery, 200);
    await panelEditPage.datasource.set('gdev-testdata');
    await panelEditPage.setVisualization('Table');
    await panelEditPage.refreshPanel();
    await expect(panelEditPage).not.toHavePanelError();
    await expect(panelEditPage.getByTestIdOrAriaLabel(selectors.components.Panels.Visualization.Table.body)).toHaveText(
      'val1val2val3val4'
    );
  });
});

test.describe('edit panel plugin settings', () => {
  test('change viz to table panel, set panel title and collapse section', async ({
    panelEditPage,
    selectors,
    page,
  }) => {
    await panelEditPage.setVisualization('Table');
    await expect(panelEditPage.getByTestIdOrAriaLabel(selectors.components.PanelEditor.toggleVizPicker)).toHaveText(
      'Table'
    );
    const panelName = 'Table panel E2E test';
    await panelEditPage.setPanelTitle(panelName);
    await expect(
      panelEditPage.getByTestIdOrAriaLabel(selectors.components.Panels.Panel.title(panelName))
    ).toBeVisible();
    await panelEditPage.collapseSection('Standard options');
    await expect(page.getByText('Display name')).toBeVisible();
  });
});
