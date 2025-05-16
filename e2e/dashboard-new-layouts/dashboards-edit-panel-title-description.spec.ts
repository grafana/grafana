import { e2e } from '../utils';

const PAGE_UNDER_TEST = '5SdHCadmz/panel-tests-graph';

describe('Dashboard', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can edit panel title and description', () => {
    e2e.pages.Dashboards.visit();
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

    e2e.flows.scenes.toggleEditMode();

    // Check that panel title is as expected
    e2e.components.Panels.Panel.headerContainer()
      .first()
      .within(() => cy.get('h2').first().should('have.text', 'No Data Points Warning'));

    e2e.flows.scenes.selectPanel(/^No Data Points Warning$/);

    // Change panel title
    e2e.components.PanelEditor.OptionsPane.fieldInput('Title')
      .should('have.value', 'No Data Points Warning')
      .clear()
      .type('New Panel Title');
    e2e.components.PanelEditor.OptionsPane.fieldInput('Title').should('have.value', 'New Panel Title');

    // Change panel description
    const newDescription = 'A description of this panel';
    e2e.components.PanelEditor.OptionsPane.fieldLabel('panel-options Description').within(() => {
      cy.get('textarea').type(newDescription);
      cy.get('textarea').should('have.value', newDescription);
    });

    // Check that new title is reflected in panel header
    cy.get('[data-testid="data-testid header-container"] h2').first().should('have.text', 'New Panel Title');

    // Reveal description tooltip and check that its value is as expected
    const descriptionIcon = () => cy.get('[data-testid="title-items-container"] > span').first();
    descriptionIcon().click({ force: true });
    descriptionIcon().then((el) => {
      const tooltipId = el.attr('aria-describedby');
      cy.get(`[id="${tooltipId}"]`).should('have.text', `${newDescription}\n`);
    });
  });
});
