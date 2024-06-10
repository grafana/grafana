import { e2e } from '../utils';

const PAGE_UNDER_TEST = '-Y-tnEDWk/templating-nested-template-variables';

describe('Variables - Load options from Url', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('default options should be correct', () => {
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });
    cy.intercept({
      method: 'POST',
      pathname: '/api/ds/query*',
    }).as('query');

    cy.wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A')
      .should('be.visible')
      .children()
      .children()
      .first()
      .click();

    e2e.components.Select.option().parent().should('have.length', 8);

    e2e.components.Select.option()
      .first()
      .should('have.text', 'All')
      .parent()
      .next()
      .should('have.text', 'B')
      .next()
      .should('have.text', 'C')
      .next()
      .should('have.text', 'D');

    cy.get('body').click(0, 0);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AA')
      .should('be.visible')
      .children()
      .children()
      .first()
      .click();

    e2e.components.Select.option().parent().should('have.length', 8);
    e2e.components.Select.option()
      .first()
      .should('have.text', 'All')
      .parent()
      .next()
      .should('have.text', 'AB')
      .next()
      .should('have.text', 'AC')
      .next()
      .should('have.text', 'AD');

    cy.get('body').click(0, 0);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('$__all')
      .should('be.visible')
      .children()
      .children()
      .first()
      .click();

    e2e.components.Select.option().parent().should('have.length', 8);

    e2e.components.Select.option()
      .first()
      .should('have.text', 'AAA')
      .parent()
      .next()
      .should('have.text', 'AAB')
      .next()
      .should('have.text', 'AAC')
      .next()
      .should('have.text', 'AAD');
  });

  it('options set in url should load correct options', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=B&var-server=BB&var-pod=BBB` });
    cy.intercept({
      method: 'POST',
      pathname: '/api/ds/query',
    }).as('query');

    cy.wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B')
      .should('be.visible')
      .children()
      .children()
      .first()
      .click();

    e2e.components.Select.option().parent().should('have.length', 8);

    e2e.components.Select.option()
      .first()
      .should('have.text', 'All')
      .parent()
      .next()
      .should('have.text', 'A')
      .next()
      .should('have.text', 'C')
      .next()
      .should('have.text', 'D');

    cy.get('body').click(0, 0);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BB')
      .should('be.visible')
      .children()
      .children()
      .first()
      .click();

    e2e.components.Select.option().parent().should('have.length', 8);

    e2e.components.Select.option()
      .first()
      .should('have.text', 'All')
      .parent()
      .next()
      .should('have.text', 'BA')
      .next()
      .should('have.text', 'BC')
      .next()
      .should('have.text', 'BD');

    cy.get('body').click(0, 0);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BBB')
      .should('be.visible')
      .children()
      .children()
      .first()
      .click();

    e2e.components.Select.option().parent().should('have.length', 8);

    e2e.components.Select.option()
      .first()
      .should('have.text', 'All')
      .parent()
      .next()
      .should('have.text', 'BBA')
      .next()
      .should('have.text', 'BBC')
      .next()
      .should('have.text', 'BBD');
  });

  it('options set in url that do not exist should load correct options', () => {
    // @ts-ignore some typing issue
    cy.on('uncaught:exception', (err) => {
      if (err.stack?.indexOf("Couldn't find any field of type string in the results.") !== -1) {
        // return false to prevent the error from
        // failing this test
        return false;
      }

      return true;
    });

    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=X` });
    cy.intercept({
      method: 'POST',
      pathname: '/api/ds/query',
    }).as('query');

    cy.wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('X')
      .should('be.visible')
      .children()
      .children()
      .first()
      .click();

    e2e.components.Select.option().parent().should('have.length', 9);

    e2e.components.Select.option()
      .first()
      .should('have.text', 'All')
      .parent()
      .next()
      .should('have.text', 'A')
      .next()
      .should('have.text', 'B')
      .next()
      .should('have.text', 'C');

    cy.get('body').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('$__all')
      .should('be.visible')
      .should('have.length', 2);
  });
});
