import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Panel menu tests',
  itName: 'Tests various panel menu scenarios',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: 'TkZXxlNG3' });
    e2e()
      .get('#panel-menu-container')
      .first()
      .within(() => {
        e2e().get('#panel-menu-button').first().type('{enter}');
        e2e().get('#main-menu').should('be.visible');
        e2e().get('#main-menu li:first > button').should('have.focus');

        e2e().get('#main-menu li:first > button').type('{downarrow}');
        e2e().get('#main-menu li:nth-child(2) > button').should('have.focus');

        // Testing menu wrap-around functionality
        e2e().focused().type('{uparrow}{uparrow}');
        e2e().get('#main-menu li:last > button').should('have.focus');

        e2e().focused().type('{downarrow}');
        e2e().get('#main-menu li:first > button').should('have.focus');

        // Testing submenu functionality
        e2e().get('#main-menu').contains('Inspect').focus().type('{rightarrow}');
        e2e().get('#panel-menu').should('be.visible');
        e2e().get('#panel-menu li:first > button').first().should('have.focus');
        e2e().focused().type('{esc}');
        e2e().get('#panel-menu-button').first().should('be.focused');
        e2e().get('#main-menu').should('not.be.visible');
      });
  },
});
