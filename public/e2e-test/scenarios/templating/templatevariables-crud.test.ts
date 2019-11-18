import { e2eScenario } from '@grafana/toolkit/src/e2e';
import { Browser, Page } from 'puppeteer-core';
import { assertVariableLabelsAndComponents, dashboardPage } from '../../pages/dashboards/dashboardPage';
import { addTestDataSourceAndVerify, cleanUpTestDataSource } from '../smoke.test';
import { createDashboardPage } from '../../pages/dashboards/createDashboardPage';
import { dashboardSettingsPage } from '../../pages/dashboards/dashboardSettingsPage';
import { assertVariableTable, variablesPage } from '../../pages/templating/variablesPage';
import { createQueryVariable, variablePage } from '../../pages/templating/variablePage';
import { saveDashboardModal } from '../../pages/dashboards/saveDashboardModal';
import { saveChangesDashboardModal } from '../../pages/dashboards/saveChangesDashboardModal';

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

    await dashboardSettingsPage.pageObjects.saveDashBoard.click();

    await saveDashboardModal.init(page);
    await saveDashboardModal.expectSelector({ selector: 'save-dashboard-as-modal' });
    await saveDashboardModal.pageObjects.name.enter(dashboardTitle);
    await saveDashboardModal.pageObjects.save.click();
    await saveDashboardModal.pageObjects.success.exists();

    await dashboardPage.pageObjects.settings.click();

    await dashboardSettingsPage.init(page);
    await dashboardSettingsPage.pageObjects.variablesSection.click();

    await variablesPage.pageObjects.callToActionButton.exists();
    await variablesPage.pageObjects.callToActionButton.click();

    const queryVariables = [
      { name: 'query1', query: '*', label: 'query1-label', options: ['All', 'A', 'B', 'C'] },
      { name: 'query2', query: '$query1.*', label: 'query2-label', options: ['All', 'AA', 'AB', 'AC'] },
      { name: 'query3', query: '$query1.$query2.*', label: 'query2-label', options: ['All', 'AAA', 'AAB', 'AAC'] },
    ];

    for (let queryVariableIndex = 0; queryVariableIndex < queryVariables.length; queryVariableIndex++) {
      const { name, label, query } = queryVariables[queryVariableIndex];
      const asserts = queryVariables.slice(0, queryVariableIndex + 1);
      await createQueryVariable({
        page: variablePage,
        dataSourceName: testDataSourceName,
        name,
        label,
        query,
      });

      await assertVariableTable(variablesPage, asserts);

      await dashboardSettingsPage.pageObjects.saveDashBoard.click();

      await saveChangesDashboardModal.init(page);
      await saveChangesDashboardModal.pageObjects.save.click();
      await saveChangesDashboardModal.pageObjects.success.exists();

      await variablesPage.pageObjects.goBackButton.click();

      await assertVariableLabelsAndComponents(dashboardPage, asserts);

      await dashboardPage.pageObjects.settings.click();

      await dashboardSettingsPage.pageObjects.variablesSection.click();

      await variablesPage.pageObjects.newVariableButton.click();
    }

    await cleanUpTestDataSource(page, testDataSourceName);
  },
});
