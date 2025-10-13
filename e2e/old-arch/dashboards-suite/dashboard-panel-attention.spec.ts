import { e2e } from '../utils';

describe('Dashboard Panel Attention', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    // Open all panels dashboard
    e2e.flows.openDashboard({ uid: 'n1jR8vnnz' });
  });

  it('Should give panel attention on focus', () => {
    e2e.components.Panels.Panel.title('State timeline').focus();
    cy.get('body').type('v');
    cy.url().should('include', 'viewPanel=41');
  });

  it('Should give panel attention on hover', () => {
    e2e.components.Panels.Panel.title('State timeline').trigger('mousemove');
    cy.wait(100); // Wait because of debounce
    cy.get('body').type('v');
    cy.url().should('include', 'viewPanel=41');
  });

  it('Should change panel attention between focus and mousemove', () => {
    e2e.components.Panels.Panel.title('Size, color mapped to different fields + share view').focus();
    e2e.components.Panels.Panel.title('State timeline').trigger('mousemove');
    cy.wait(100); // Wait because of debounce
    cy.get('body').type('v');
    cy.url().should('include', 'viewPanel=41');
  });
});
