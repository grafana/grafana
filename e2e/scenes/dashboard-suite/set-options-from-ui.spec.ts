import { e2e } from '../utils';

const PAGE_UNDER_TEST = '-Y-tnEDWk/templating-nested-template-variables';

describe('Variables - Set options from ui', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('clicking a value that is not part of dependents options should change these to All', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=A&var-server=AA&var-pod=AAA` });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A').should('be.visible').click().click();
    e2e.components.Select.option().contains('B').click();
    cy.get('body').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B').scrollIntoView().should('be.visible');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('$__all')
      .should('have.length', 2)
      .eq(0)
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });

    e2e.components.Select.option().parent().should('have.length', 8);
    e2e.components.Select.option()
      .first()
      .should('have.text', 'BA')
      .parent()
      .next()
      .should('have.text', 'BB')
      .next()
      .should('have.text', 'BC');

    cy.get('body').click();

    e2e.pages.Dashboard.SubMenu.submenuItemLabels('pod')
      .next()
      .within(() => {
        cy.get('input').click();
      });

    // length is 11 because of virtualized select options
    e2e.components.Select.option().parent().should('have.length', 11);

    e2e.components.Select.option()
      .first()
      .should('have.text', 'BAA')
      .parent()
      .next()
      .should('have.text', 'BAB')
      .next()
      .should('have.text', 'BAC')
      .next()
      .should('have.text', 'BAD')
      .next()
      .should('have.text', 'BAE')
      .next()
      .should('have.text', 'BAF');
  });

  it('adding a value that is not part of dependents options should add the new values dependant options', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=A&var-server=AA&var-pod=AAA` });
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');

    cy.wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A')
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });
    e2e.components.Select.option().contains('B').click();
    cy.get('body').click();

    cy.wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A,B').scrollIntoView().should('be.visible');

    e2e.components.LoadingIndicator.icon().should('have.length', 0);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AA')
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });

    e2e.components.Select.option().should('have.length', 11);

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

    cy.get('body').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AAA')
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });

    e2e.components.Select.option().should('have.length', 8);

    e2e.components.Select.option()
      .first()
      .should('have.text', 'All')
      .parent()
      .next()
      .should('have.text', 'AAB')
      .next()
      .should('have.text', 'AAC');
  });

  it('removing a value that is part of dependents options should remove the new values dependant options', () => {
    e2e.flows.openDashboard({
      uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=A&var-datacenter=B&var-server=AA&var-server=BB&var-pod=AAA&var-pod=BBB`,
    });
    cy.intercept({ pathname: '/api/ds/query' }).as('query');

    cy.wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A,B')
      .should('be.visible')
      .children()
      .first()
      .click();

    cy.get('body').click();

    cy.wait(300);
    cy.wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B')
      .scrollIntoView()
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });

    cy.get('body').click();

    e2e.components.LoadingIndicator.icon().should('have.length', 0);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BB')
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });

    e2e.components.Select.option().should('have.length', 8);

    e2e.components.Select.option()
      .first()
      .should('have.text', 'All')
      .parent()
      .next()
      .should('have.text', 'BA')
      .next()
      .should('have.text', 'BC');

    cy.get('body').click(0, 0);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BBB')
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });
    e2e.components.Select.option().should('have.length', 8);

    e2e.components.Select.option()
      .first()
      .should('have.text', 'All')
      .parent()
      .next()
      .should('have.text', 'BBA')
      .next()
      .should('have.text', 'BBC');
  });
});
