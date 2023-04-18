import { e2e } from '@grafana/e2e';
const DASHBOARD_ID = 'ed155665';

e2e.scenario({
  describeName: 'Annotations filtering',
  itName: 'Tests switching filter type updates the UI accordingly',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID });

    e2e.components.PageToolbar.item('Dashboard settings').click();
    e2e.components.Tab.title('Annotations').click();
    cy.contains('New query').click();
    e2e.pages.Dashboard.Settings.Annotations.Settings.name().clear().type('Red - Panel two');

    e2e.pages.Dashboard.Settings.Annotations.NewAnnotation.showInLabel()
      .should('be.visible')
      .within(() => {
        // All panels
        e2e().get(`input[id*="annotations-type-input"]`).click({ force: true }).type('All panels{enter}');

        e2e().get(`input[id*="choose-panels-input"]`).should('not.exist');

        // All panels except
        e2e().get(`input[id*="annotations-type-input"]`).click({ force: true }).type('All panels except{enter}');

        e2e().get(`input[id*="choose-panels-input"]`).should('be.visible');

        // Selected panels
        e2e().get(`input[id*="annotations-type-input"]`).click({ force: true }).type('Selected panels{enter}');

        e2e()
          .get(`input[id*="choose-panels-input"]`)
          .should('be.visible')
          .click({ force: true })
          .type('Panel two{enter}');
      });

    e2e.pages.Dashboard.Settings.Annotations.NewAnnotation.previewInDashboard().click({ force: true });

    e2e.pages.Dashboard.SubMenu.Annotations.annotationsWrapper()
      .should('be.visible')
      .within(() => {
        e2e.pages.Dashboard.SubMenu.Annotations.annotationLabel('Red - Panel two').should('be.visible');
        e2e.pages.Dashboard.SubMenu.Annotations.annotationToggle('Red - Panel two')
          .should('be.checked')
          .uncheck({ force: true })
          .should('not.be.checked')
          .check({ force: true });

        e2e.pages.Dashboard.SubMenu.Annotations.annotationLabel('Red, only panel 1').should('be.visible');
        e2e.pages.Dashboard.SubMenu.Annotations.annotationToggle('Red, only panel 1').should('be.checked');
      });

    e2e().wait(3000);

    // @TODO Change the annotations count
    e2e.components.Panels.Panel.title('Panel one')
      .should('exist')
      .within(() => {
        e2e.pages.SoloPanel.Annotations.marker().should('exist').should('have.length', 4);
      });
  },
});
