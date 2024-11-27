import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';

describe('Keyboard shortcuts', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));

    cy.visit(fromBaseUrl('/'));

    // wait for the page to load
    e2e.components.Panels.Panel.title('Latest from the blog').should('be.visible');
  });

  it('sequence shortcuts should work', () => {
    cy.get('body').type('ge');
    e2e.pages.Explore.General.container().should('be.visible');

    cy.get('body').type('gp');
    e2e.components.UserProfile.preferencesSaveButton().should('be.visible');

    cy.get('body').type('gh');
    e2e.components.Panels.Panel.title('Latest from the blog').should('be.visible');
  });

  it('ctrl+z should zoom out the time range', () => {
    cy.get('body').type('ge');
    e2e.pages.Explore.General.container().should('be.visible');

    // Time range is 1 minute, so each shortcut press should jump back or forward by 1 minute
    e2e.flows.setTimeRange({
      from: '2024-06-05 10:05:00',
      to: '2024-06-05 10:06:00',
      zone: 'Browser',
    });
    e2e.components.RefreshPicker.runButtonV2().should('have.text', 'Run query');
    let expectedRange = `Time range selected: 2024-06-05 10:05:00 to 2024-06-05 10:06:00`;
    e2e.components.TimePicker.openButton().should('have.attr', 'aria-label', expectedRange);

    cy.get('body').type('{ctrl}z');
    e2e.components.RefreshPicker.runButtonV2().should('have.text', 'Run query');
    expectedRange = `Time range selected: 2024-06-05 10:03:30 to 2024-06-05 10:07:30`;
    e2e.components.TimePicker.openButton().should('have.attr', 'aria-label', expectedRange);
  });

  it('time range shortcuts should work', () => {
    cy.get('body').type('ge');
    e2e.pages.Explore.General.container().should('be.visible');

    // Time range is 1 minute, so each shortcut press should jump back or forward by 1 minute
    e2e.flows.setTimeRange({
      from: '2024-06-05 10:05:00',
      to: '2024-06-05 10:06:00',
      zone: 'Browser',
    });
    e2e.components.RefreshPicker.runButtonV2().should('have.text', 'Run query');
    let expectedRange = `Time range selected: 2024-06-05 10:05:00 to 2024-06-05 10:06:00`;
    e2e.components.TimePicker.openButton().should('have.attr', 'aria-label', expectedRange);

    cy.log('Trying one shift-left');
    cy.get('body').type('t{leftarrow}');
    e2e.components.RefreshPicker.runButtonV2().should('have.text', 'Run query');
    expectedRange = `Time range selected: 2024-06-05 10:04:00 to 2024-06-05 10:05:00`; // 1 min back
    e2e.components.TimePicker.openButton().should('have.attr', 'aria-label', expectedRange);
  });
});
