import { e2eScenario } from '@grafana/toolkit/src/e2e';
import { Browser, Page } from 'puppeteer-core';
import { createDashboardPage } from '../../pages/dashboards/createDashboardPage';
import { dashboardPage } from '../../pages/dashboards/dashboardPage';
import { dashboardSettingsPage } from '../../pages/dashboards/dashboardSettingsPage';
import { variablePage } from '../../pages/templating/variablePage';
import { addTestDataSourceAndVerify, cleanUpTestDataSource } from '../smoke.test';
import { variablesPage } from '../../pages/templating/variablesPage';
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

    console.log('Creating a Query Variable with required');
    await variablePage.pageObjects.generalNameInput.enter('query');
    await variablePage.pageObjects.generalLabelInput.enter('query-label');
    await variablePage.pageObjects.queryOptionsDataSourceSelect.select(`string:${testDataSourceName}`);
    await variablePage.pageObjects.queryOptionsQueryInput.exists();
    await variablePage.pageObjects.queryOptionsQueryInput.containsPlaceholder('metric name or tags query');
    await variablePage.pageObjects.queryOptionsQueryInput.enter('*');
    await variablePage.pageObjects.queryOptionsQueryInput.blur();
    await variablePage.pageObjects.previewOfValuesOption.exists();
    await variablePage.pageObjects.selectionOptionsMultiSwitch.toggle();
    await variablePage.pageObjects.selectionOptionsMultiSwitch.isSwitchedOn();
    await variablePage.pageObjects.selectionOptionsIncludeAllSwitch.toggle();
    await variablePage.pageObjects.selectionOptionsIncludeAllSwitch.isSwitchedOn();
    await variablePage.pageObjects.selectionOptionsCustomAllInput.exists();
    await variablePage.pageObjects.selectionOptionsCustomAllInput.containsText('');
    await variablePage.pageObjects.selectionOptionsCustomAllInput.containsPlaceholder('blank = auto');
    await variablePage.pageObjects.addButton.click();
    console.log('Creating a Query Variable with required, OK!');

    await variablesPage.pageObjects.variableTableNameField.containsText('query');
    await variablesPage.pageObjects.variableTableDuplicateButton.exists();
    await variablesPage.pageObjects.variableTableRemoveButton.exists();

    await dashboardSettingsPage.pageObjects.saveDashBoard.click();

    await saveDashboardModal.init(page);
    await saveDashboardModal.expectSelector({ selector: 'save-dashboard-as-modal' });
    await saveDashboardModal.pageObjects.name.enter(dashboardTitle);
    await saveDashboardModal.pageObjects.save.click();
    await saveDashboardModal.pageObjects.success.exists();

    await dashboardPage.pageObjects.submenuItemLabel.containsText('query-label');
    await dashboardPage.pageObjects.submenuItemValueDropDownValueLink.exists();
    await dashboardPage.pageObjects.submenuItemValueDropDownValueLink.click();
    await dashboardPage.pageObjects.submenuItemValueDropDownOptionText.exists();

    await cleanUpTestDataSource(page, testDataSourceName);
  },
});
