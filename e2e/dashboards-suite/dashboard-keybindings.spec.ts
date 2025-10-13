import { e2e } from '../utils';

describe('Dashboard keybindings', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('should collapse and expand all rows', () => {
    e2e.flows.openDashboard({ uid: 'Repeating-rows-uid/repeating-rows' });
    e2e.components.Panels.Panel.content().should('have.length', 5);
    e2e.components.Panels.Panel.title('server = A, pod = Bob').should('be.visible');
    e2e.components.Panels.Panel.title('server = B, pod = Bob').should('be.visible');

    cy.get('body').type('d').type('{shift}c');
    e2e.components.Panels.Panel.content().should('have.length', 0);
    e2e.components.Panels.Panel.title('server = A, pod = Bob').should('not.exist');
    e2e.components.Panels.Panel.title('server = B, pod = Bob').should('not.exist');

    cy.get('body').type('d').type('{shift}e');
    e2e.components.Panels.Panel.content().should('have.length', 6);
    e2e.components.Panels.Panel.title('server = A, pod = Bob').should('be.visible');
    e2e.components.Panels.Panel.title('server = B, pod = Bob').should('be.visible');
  });

  it('should open panel inspect', () => {
    e2e.flows.openDashboard({ uid: 'edediimbjhdz4b/a-tall-dashboard' });
    e2e.components.Panels.Panel.title('Panel #1').type('i');
    e2e.components.PanelInspector.Json.content().should('be.visible');
    cy.get('body').type('{esc}');
    e2e.components.PanelInspector.Json.content().should('not.exist');
  });
});
