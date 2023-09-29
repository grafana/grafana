import { e2e } from '../utils';

describe('Select focus/unfocus tests', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Tests select focus/unfocus scenarios', () => {
    e2e.flows.openDashboard({ uid: '5SdHCadmz' });
    e2e.components.PageToolbar.item('Dashboard settings').click();

    e2e.components.FolderPicker.containerV2()
      .should('be.visible')
      .within(() => {
        cy.get('#dashboard-folder-input').should('be.visible').click();
      });

    e2e.components.Select.option().should('be.visible').first().click();

    e2e.components.FolderPicker.containerV2()
      .should('be.visible')
      .within(() => {
        cy.get('#dashboard-folder-input').should('exist').should('have.focus');
      });

    e2e.pages.Dashboard.Settings.General.title().click();

    e2e.components.FolderPicker.containerV2()
      .should('be.visible')
      .within(() => {
        cy.get('#dashboard-folder-input').should('exist').should('not.have.focus');
      });
  });
});
