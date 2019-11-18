import { e2eScenario } from '@grafana/toolkit/src/e2e';
import { Browser, Page } from 'puppeteer-core';
import { dashboardPage } from '../../pages/dashboards/dashboardPage';
import { addTestDataSourceAndVerify, cleanUpTestDataSource } from '../smoke.test';
import { createDashboardPage } from '../../pages/dashboards/createDashboardPage';
import { dashboardSettingsPage } from '../../pages/dashboards/dashboardSettingsPage';
import { variablesPage } from '../../pages/templating/variablesPage';
import { createQueryVariable, variablePage } from '../../pages/templating/variablePage';
import { saveDashboardModal } from '../../pages/dashboards/saveDashboardModal';

e2eScenario({
  describeName: 'Template Variables tests',
  itName: 'Template Variables QueryVariable CRUD',
  scenario: async (browser: Browser, page: Page) => {
    const testDataSourceName = await addTestDataSourceAndVerify(page);
    const dashboardTitle = `e2e - QueryVariable CRUD - ${new Date().getTime()}`;
    await createDashboardPage.init(page);
    await createDashboardPage.navigateTo();

    await dashboardPage.init(page);
    await dashboardPage.pageObjects.settings.click();

    await dashboardSettingsPage.init(page);
    await dashboardSettingsPage.pageObjects.variablesSection.click();

    await variablesPage.init(page);
    await variablesPage.pageObjects.callToActionButton.exists();
    await variablesPage.pageObjects.callToActionButton.click();

    console.log('Asserting defaults for new variable');
    await variablePage.init(page);
    await variablePage.pageObjects.generalNameInput.exists();
    await variablePage.pageObjects.generalNameInput.containsText('');
    await variablePage.pageObjects.generalNameInput.containsPlaceholder('name');
    await variablePage.pageObjects.generalTypeSelect.exists();
    await variablePage.pageObjects.generalTypeSelect.selectedTextIs('Query');
    await variablePage.pageObjects.generalLabelInput.exists();
    await variablePage.pageObjects.generalLabelInput.containsText('');
    await variablePage.pageObjects.generalLabelInput.containsPlaceholder('optional display name');
    await variablePage.pageObjects.generalHideSelect.exists();
    await variablePage.pageObjects.generalHideSelect.selectedTextIs('');
    await variablePage.pageObjects.queryOptionsDataSourceSelect.exists();
    await variablePage.pageObjects.queryOptionsDataSourceSelect.selectedTextIs('');
    await variablePage.pageObjects.queryOptionsRefreshSelect.exists();
    await variablePage.pageObjects.queryOptionsRefreshSelect.selectedTextIs('Never');
    await variablePage.pageObjects.queryOptionsRegExInput.exists();
    await variablePage.pageObjects.queryOptionsRegExInput.containsText('');
    await variablePage.pageObjects.queryOptionsRegExInput.containsPlaceholder('/.*-(.*)-.*/');
    await variablePage.pageObjects.queryOptionsSortSelect.exists();
    await variablePage.pageObjects.queryOptionsSortSelect.selectedTextIs('Disabled');
    await variablePage.pageObjects.selectionOptionsMultiSwitch.exists();
    await variablePage.pageObjects.selectionOptionsMultiSwitch.isSwitchedOff();
    await variablePage.pageObjects.selectionOptionsIncludeAllSwitch.exists();
    await variablePage.pageObjects.selectionOptionsIncludeAllSwitch.isSwitchedOff();
    await variablePage.pageObjects.valueGroupsTagsEnabledSwitch.exists();
    await variablePage.pageObjects.valueGroupsTagsEnabledSwitch.isSwitchedOff();
    console.log('Asserting defaults for new variable, OK!');

    const queryVariable1Name = 'query';
    const queryVariable1Label = 'query-label';
    const queryVariable1Query = '*';
    await createQueryVariable({
      page: variablePage,
      dataSourceName: testDataSourceName,
      name: queryVariable1Name,
      label: queryVariable1Label,
      query: queryVariable1Query,
    });

    await variablesPage.pageObjects.variableTableNameField.waitForSelector();
    await variablesPage.pageObjects.variableTableNameField.hasLength(1);
    await variablesPage.pageObjects.variableTableNameField.containsTextAtPos(`$${queryVariable1Name}`, 0);
    await variablesPage.pageObjects.variableTableDefinitionField.hasLength(1);
    await variablesPage.pageObjects.variableTableDefinitionField.containsTextAtPos(queryVariable1Query, 0);
    await variablesPage.pageObjects.variableTableArrowUpButton.hasLength(1);
    await variablesPage.pageObjects.variableTableArrowDownButton.hasLength(1);
    await variablesPage.pageObjects.variableTableDuplicateButton.hasLength(1);
    await variablesPage.pageObjects.variableTableRemoveButton.hasLength(1);

    await dashboardSettingsPage.pageObjects.saveDashBoard.click();

    await saveDashboardModal.init(page);
    await saveDashboardModal.expectSelector({ selector: 'save-dashboard-as-modal' });
    await saveDashboardModal.pageObjects.name.enter(dashboardTitle);
    await saveDashboardModal.pageObjects.save.click();
    await saveDashboardModal.pageObjects.success.exists();

    await dashboardPage.pageObjects.submenuItemLabel.waitForSelector();
    await dashboardPage.pageObjects.submenuItemLabel.hasLength(1);
    await dashboardPage.pageObjects.submenuItemLabel.containsTextAtPos(queryVariable1Label, 0);
    await dashboardPage.pageObjects.submenuItemValueDropDownValueLink.exists();
    await dashboardPage.pageObjects.submenuItemValueDropDownValueLink.click();
    await dashboardPage.pageObjects.submenuItemValueDropDownOptionText.hasLength(4);
    await dashboardPage.pageObjects.submenuItemValueDropDownOptionText.containsTextAtPos('All', 0);
    await dashboardPage.pageObjects.submenuItemValueDropDownOptionText.containsTextAtPos('A', 1);
    await dashboardPage.pageObjects.submenuItemValueDropDownOptionText.containsTextAtPos('B', 2);
    await dashboardPage.pageObjects.submenuItemValueDropDownOptionText.containsTextAtPos('C', 3);

    await cleanUpTestDataSource(page, testDataSourceName);
  },
});
