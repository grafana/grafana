import { expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';
import { successfulDataQuery } from '../mocks/queries';
import { scenarios } from '../mocks/resources';

const PANEL_TITLE = 'Table panel E2E test';
const TABLE_VIZ_NAME = 'Table';
const TIME_SERIES_VIZ_NAME = 'Time series';
const STANDARD_OTIONS_CATEGORY = 'Standard options';
const DISPLAY_NAME_LABEL = 'Display name';
const REACT_TABLE_DASHBOARD = { uid: 'U_bZIMRMk' };

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
  test('and resource `scenarios` is mocked', async ({ selectors, dashboardPage }) => {
    await dashboardPage.mockResourceResponse('scenarios', scenarios);
    const panelEditPage = await dashboardPage.addPanel();
    await panelEditPage.datasource.set('gdev-testdata');
    const queryEditorRow = await panelEditPage.getQueryEditorRow('A');
    await queryEditorRow.getByLabel('Scenario').last().click();
    await expect(
      panelEditPage.getByGrafanaSelector(selectors.components.Select.option),
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
      panelEditPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Table.body),
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
      panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker),
      formatExpectError('Expected panel visualization to be set to table')
    ).toHaveText(TABLE_VIZ_NAME);
    await panelEditPage.setPanelTitle(PANEL_TITLE);
    await expect(
      panelEditPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_TITLE)),
      formatExpectError('Expected panel title to be updated')
    ).toBeVisible();
    await panelEditPage.collapseSection(STANDARD_OTIONS_CATEGORY);
    await expect(
      page.getByText(DISPLAY_NAME_LABEL),
      formatExpectError('Expected section to be collapsed')
    ).toBeVisible();
  });

  test('Select time zone in timezone picker', async ({ panelEditPage }) => {
    await panelEditPage.setVisualization(TIME_SERIES_VIZ_NAME);
    const axisOptions = await panelEditPage.getCustomOptions('Axis');
    const timeZonePicker = axisOptions.getSelect('Time zone');

    await timeZonePicker.selectOption('Europe/Stockholm');
    await expect(timeZonePicker).toHaveSelected('Europe/Stockholm');
  });

  test('select unit in unit picker', async ({ panelEditPage }) => {
    await panelEditPage.setVisualization(TIME_SERIES_VIZ_NAME);
    const standardOptions = panelEditPage.getStandardOptions();
    const unitPicker = standardOptions.getUnitPicker('Unit');

    await unitPicker.selectOption('Misc > Pixels');

    await expect(unitPicker).toHaveSelected('Pixels');
  });

  test('enter value in number input', async ({ panelEditPage }) => {
    await panelEditPage.setVisualization(TIME_SERIES_VIZ_NAME);
    const axisOptions = panelEditPage.getCustomOptions('Axis');
    const lineWith = axisOptions.getNumberInput('Soft min');

    await lineWith.fill('10');

    await expect(lineWith).toHaveValue('10');
  });

  test('enter value in slider', async ({ panelEditPage }) => {
    await panelEditPage.setVisualization(TIME_SERIES_VIZ_NAME);
    const graphOptions = panelEditPage.getCustomOptions('Graph styles');
    const lineWidth = graphOptions.getSliderInput('Line width');

    await lineWidth.fill('10');

    await expect(lineWidth).toHaveValue('10');
  });

  test('select value in single value select', async ({ panelEditPage }) => {
    await panelEditPage.setVisualization(TIME_SERIES_VIZ_NAME);
    const standardOptions = panelEditPage.getStandardOptions();
    const colorSchemeSelect = standardOptions.getSelect('Color scheme');

    await colorSchemeSelect.selectOption('Classic palette');
    await expect(colorSchemeSelect).toHaveSelected('Classic palette');
  });

  test('clear input', async ({ panelEditPage }) => {
    await panelEditPage.setVisualization(TIME_SERIES_VIZ_NAME);
    const panelOptions = panelEditPage.getPanelOptions();
    const title = panelOptions.getTextInput('Title');

    await expect(title).toHaveValue('Panel Title');
    await title.clear();
    await expect(title).toHaveValue('');
  });

  test('enter value in input', async ({ panelEditPage }) => {
    await panelEditPage.setVisualization(TIME_SERIES_VIZ_NAME);
    const panelOptions = panelEditPage.getPanelOptions();
    const description = panelOptions.getTextInput('Description');

    await expect(description).toHaveValue('');
    await description.fill('This is a panel');
    await expect(description).toHaveValue('This is a panel');
  });

  test('unchecking switch', async ({ panelEditPage }) => {
    await panelEditPage.setVisualization(TIME_SERIES_VIZ_NAME);
    const axisOptions = panelEditPage.getCustomOptions('Axis');
    const showBorder = axisOptions.getSwitch('Show border');

    await expect(showBorder).toBeChecked({ checked: false });
    await showBorder.check();
    await expect(showBorder).toBeChecked();

    await showBorder.uncheck();
    await expect(showBorder).toBeChecked({ checked: false });
  });

  test('checking switch', async ({ panelEditPage }) => {
    await panelEditPage.setVisualization(TIME_SERIES_VIZ_NAME);
    const axisOptions = panelEditPage.getCustomOptions('Axis');
    const showBorder = axisOptions.getSwitch('Show border');

    await expect(showBorder).toBeChecked({ checked: false });
    await showBorder.check();
    await expect(showBorder).toBeChecked();
  });

  test('re-selecting value in radio button group', async ({ panelEditPage }) => {
    await panelEditPage.setVisualization(TIME_SERIES_VIZ_NAME);
    const axisOptions = panelEditPage.getCustomOptions('Axis');
    const placement = axisOptions.getRadioGroup('Placement');

    await placement.check('Right');
    await expect(placement).toHaveChecked('Right');

    await placement.check('Auto');
    await expect(placement).toHaveChecked('Auto');
  });

  test('selecting value in radio button group', async ({ panelEditPage }) => {
    await panelEditPage.setVisualization(TIME_SERIES_VIZ_NAME);
    const axisOptions = panelEditPage.getCustomOptions('Axis');
    const placement = axisOptions.getRadioGroup('Placement');

    await placement.check('Right');
    await expect(placement).toHaveChecked('Right');
  });
});

test('backToDashboard method should navigate to dashboard page', async ({ gotoPanelEditPage, page }) => {
  const panelEditPage = await gotoPanelEditPage({ dashboard: REACT_TABLE_DASHBOARD, id: '4' });
  await panelEditPage.backToDashboard();
  await expect(page.url()).not.toContain('editPanel');
});
