import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Select focus/unfocus tests',
  itName: 'Tests select focus/unfocus scenarios',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: '5SdHCadmz' });
    e2e.components.PageToolbar.item('Dashboard settings').click();

    e2e.components.FolderPicker.containerV2()
      .should('be.visible')
      .within(() => {
        e2e().get('#dashboard-folder-input').should('be.visible').click();
      });

    e2e.components.Select.option().should('be.visible').first().click();

    e2e.components.FolderPicker.containerV2()
      .should('be.visible')
      .within(() => {
        e2e().get('#dashboard-folder-input').should('exist').should('have.focus');
      });

    e2e.pages.Dashboard.Settings.General.title().click();

    e2e.components.FolderPicker.containerV2()
      .should('be.visible')
      .within(() => {
        e2e().get('#dashboard-folder-input').should('exist').should('not.have.focus');
      });
  },
});
