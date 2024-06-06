import { e2e } from '../utils';
import { fromBaseUrl } from '../utils/support/url';

const options = {
  defaultCommandTimeout: 5 * 1000,
};

describe('Keyboard shortcuts', options, () => {
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

  it('ctrl+z should zoom out the time range', options, () => {
    cy.get('body').type('ge');
    e2e.pages.Explore.General.container().should('be.visible');

    // Time range is 1 minute, so each shortcut press should jump back or forward by 1 minute
    e2e.flows.setTimeRange({
      from: '2024-06-05 10:05:00',
      to: '2024-06-05 10:06:00',
      zone: 'Browser',
    });
    e2e.components.TimePicker.fromField().should('not.exist');
    cy.wait(500); // waiting is anti-pattern, but it's inconsistent for me locally without this

    cy.get('body').type('{ctrl}z');
    let expectedRange = `Time range selected: 2024-06-05 10:03:30 to 2024-06-05 10:07:30`;
    e2e.components.TimePicker.openButton().should('have.attr', 'aria-label', expectedRange);
  });

  it('multiple time range shortcuts should work', options, () => {
    cy.get('body').type('ge');
    e2e.pages.Explore.General.container().should('be.visible');

    // Time range is 1 minute, so each shortcut press should jump back or forward by 1 minute
    e2e.flows.setTimeRange({
      from: '2024-06-05 10:05:00',
      to: '2024-06-05 10:06:00',
      zone: 'Browser',
    });
    e2e.components.TimePicker.fromField().should('not.exist');
    cy.wait(500); // waiting is anti-pattern, but it's inconsistent for me locally without this

    cy.log('Trying one shift-left');
    cy.get('body').type('t{leftarrow}');
    let expectedRange = `Time range selected: 2024-06-05 10:04:00 to 2024-06-05 10:05:00`; // 1 min back
    e2e.components.TimePicker.openButton().should('have.attr', 'aria-label', expectedRange);

    cy.log('Trying two shift-lefts');
    cy.get('body').type('t{leftarrow}');
    cy.get('body').type('t{leftarrow}');
    expectedRange = `Time range selected: 2024-06-05 10:02:00 to 2024-06-05 10:03:00`; // 2 mins back
    e2e.components.TimePicker.openButton().should('have.attr', 'aria-label', expectedRange);

    cy.log('Trying two shift-lefts and a shift-right');
    cy.get('body').type('t{leftarrow}');
    cy.get('body').type('t{leftarrow}');
    cy.get('body').type('t{rightarrow}');
    expectedRange = `Time range selected: 2024-06-05 10:01:00 to 2024-06-05 10:02:00`; // 2 mins back, 1 min forward (1 min back total)
    e2e.components.TimePicker.openButton().should('have.attr', 'aria-label', expectedRange);
  });
});
