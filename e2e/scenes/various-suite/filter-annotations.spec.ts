import { e2e } from '../utils';
const DASHBOARD_ID = 'ed155665';

// Skipping due to race conditions with same old arch test e2e/various-suite/filter-annotations.spec.ts
describe.skip('Annotations filtering', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Tests switching filter type updates the UI accordingly', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID });

    e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();
    e2e.components.NavToolbar.editDashboard.settingsButton().should('be.visible').click();

    e2e.components.Tab.title('Annotations').click();
    cy.contains('New query').click();
    e2e.pages.Dashboard.Settings.Annotations.Settings.name().clear().type('Red - Panel two');

    e2e.pages.Dashboard.Settings.Annotations.NewAnnotation.showInLabel()
      .should('be.visible')
      .within(() => {
        // All panels
        e2e.components.Annotations.annotationsTypeInput().find('input').type('All panels{enter}', { force: true });
        e2e.components.Annotations.annotationsChoosePanelInput().should('not.exist');

        // All panels except
        e2e.components.Annotations.annotationsTypeInput()
          .find('input')
          .type('All panels except{enter}', { force: true });
        e2e.components.Annotations.annotationsChoosePanelInput().should('be.visible');

        // Selected panels
        e2e.components.Annotations.annotationsTypeInput().find('input').type('Selected panels{enter}', { force: true });
        e2e.components.Annotations.annotationsChoosePanelInput()
          .should('be.visible')
          .find('input')
          .type('Panel two{enter}', { force: true });
      });

    cy.get('body').click();

    e2e.components.NavToolbar.editDashboard.backToDashboardButton().should('be.visible').click();

    e2e.pages.Dashboard.Controls()
      .should('be.visible')
      .within(() => {
        e2e.pages.Dashboard.SubMenu.submenuItemLabels('Red - Panel two')
          .should('be.visible')
          .parent()
          .within((el) => {
            cy.get('input')
              .should('be.checked')
              .uncheck({ force: true })
              .should('not.be.checked')
              .check({ force: true });
          });

        e2e.pages.Dashboard.SubMenu.submenuItemLabels('Red, only panel 1')
          .should('be.visible')
          .parent()
          .within((el) => {
            cy.get('input').should('be.checked');
          });
      });

    e2e.components.Panels.Panel.title('Panel one')
      .should('exist')
      .within(() => {
        e2e.pages.Dashboard.Annotations.marker().should('exist').should('have.length', 4);
      });
  });
});
