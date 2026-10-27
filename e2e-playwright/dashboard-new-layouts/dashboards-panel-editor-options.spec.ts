import { test, expect } from './fixtures';
import { flows } from './helpers/flows';

test.use({
  featureToggles: { dashboardNewLayouts: true, dashboardUndoRedo: true },
  openFeature: { flags: { queryEditorNext: true } },
  viewport: { width: 1920, height: 1080 },
});

test.describe('Panel options in the new query editor', { tag: ['@dashboards', '@queryEditorNext'] }, () => {
  test('edits global options on a new unsaved Stat panel', async ({
    gotoDashboardPage,
    page,
    controls,
    sidebar,
    panels,
    panelEditor,
  }) => {
    test.slow();
    await gotoDashboardPage({});
    await sidebar.closePane();
    await flows.variables.addNewGenericVariable(sidebar, controls, { name: 'region', type: 'custom', value: '' }, true);
    await sidebar.variableOptions.custom.openEditor();
    await sidebar.variableOptions.custom.selectFormat('CSV');
    await sidebar.variableOptions.custom.setValues('east, west');
    await sidebar.variableOptions.custom.applyChanges();
    await sidebar.variableOptions.selection.toggle('Multi-value');

    await sidebar.toolbar.clickButton('Add');
    await sidebar.addOptions.addPanel();
    await sidebar.panelOptions.editVisualization();
    await expect(panelEditor.getAllVisualizationsTab()).toBeVisible();
    await panelEditor.selectVisualization('Stat');

    const options = panelEditor.options;
    await options.setTitle('Region $region');
    const preview = panels.getPanel('Region east', panelEditor.getContainer());
    await expect(preview).toBeVisible();

    await options.toggleTransparentBackground();
    await expect(options.getTransparentBackgroundSwitch()).toBeChecked();
    await expect(preview).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

    await options.getDescriptionTextarea().fill('Panel options regression');
    await options.getSubtitleSwitch().click();
    await expect(options.getSubtitleInput()).toBeChecked();
    await expect(panelEditor.getPreviewSubtitle()).toHaveText('Panel options regression');

    await options.repeatOptions.repeatByVariable('region');
    await expect(options.repeatOptions.getRepeatByVariableSelect()).toHaveValue('region');

    await options.conditionalRenderingOptions.selectVisibility('hide');
    await expect(options.conditionalRenderingOptions.getVisibilityRadio('hide')).toBeChecked();
    await options.conditionalRenderingOptions.selectVisibility('show');
    await expect(options.conditionalRenderingOptions.getVisibilityRadio('show')).toBeChecked();
    await expect(page).toHaveURL(/\/dashboard\/new\?.*editPanel=/);
  });

  test('keeps panel options responsive after sidebar and table-view remounts', async ({
    gotoDashboardPage,
    panelEditor,
  }) => {
    test.slow();
    await gotoDashboardPage({ uid: '5SdHCadmz', queryParams: new URLSearchParams({ editPanel: '3' }) });
    await expect(panelEditor.getVisualizationPickerToggle()).toBeVisible();
    await panelEditor.selectVisualization('Stat');

    const options = panelEditor.options;
    await options.toggleTransparentBackground();
    await expect(options.getTransparentBackgroundSwitch()).toBeChecked();
    await options.getDescriptionTextarea().fill('Before preview remount');
    await options.getSubtitleSwitch().click();
    await expect(panelEditor.getPreviewSubtitle()).toHaveText('Before preview remount');

    await panelEditor.toggleSidebarSize();
    await options.toggleTransparentBackground();
    await expect(options.getTransparentBackgroundSwitch()).toBeChecked({ checked: false });
    await options.getDescriptionTextarea().fill('After sidebar remount');
    await options.getDescriptionTextarea().blur();
    await expect(panelEditor.getPreviewSubtitle()).toHaveText('After sidebar remount');

    await panelEditor.toggleTableView();
    await expect(panelEditor.getTableViewSwitch()).toBeChecked();
    await panelEditor.toggleTableView();
    await expect(panelEditor.getTableViewSwitch()).toBeChecked({ checked: false });
    await options.toggleTransparentBackground();
    await expect(options.getTransparentBackgroundSwitch()).toBeChecked();
    await options.getDescriptionTextarea().fill('After table-view remount');
    await options.getDescriptionTextarea().blur();
    await expect(panelEditor.getPreviewSubtitle()).toHaveText('After table-view remount');
  });
});
