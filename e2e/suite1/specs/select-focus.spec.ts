import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Select focus/unfocus tests',
  itName: 'Tests select focus/unfocus scenarios',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: '5SdHCadmz' });
    e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();

    e2e.components.FolderPicker.container()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.input()
          .should('be.visible')
          .click();

        e2e.components.Select.option()
          .should('be.visible')
          .first()
          .click();

        e2e.components.Select.input()
          .should('be.visible')
          .should('have.focus');
      });

    e2e.pages.Dashboard.Settings.General.title().click();

    e2e.components.FolderPicker.container()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.input()
          .should('be.visible')
          .should('not.have.focus');
      });
  },
});
