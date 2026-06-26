import { selectors } from '@grafana/e2e-selectors';

import { e2e } from '../utils';

const PAGE_UNDER_TEST = '-Y-tnEDWk/templating-nested-template-variables';

describe('Variables - Set options from ui', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('clicking a value that is not part of dependents options should change these to All', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=A&var-server=AA&var-pod=AAA` });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A')
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A').should('be.visible').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B').should('be.visible').click();

    cy.get('body').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B').scrollIntoView().should('be.visible');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('$__all')
      .should('have.length', 2)
      .eq(0)
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });

    e2e.components.Select.option().parent().should('have.length', 10);

    e2e.components.Select.toggleAllOptions().should('have.text', 'Selected (1)');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').should('be.visible');

    cy.get('body').click();

    e2e.pages.Dashboard.SubMenu.submenuItemLabels('pod')
      .parent()
      .within(() => {
        cy.get('input').click();
      });

    // length is 11 because of virtualized select options
    e2e.components.Select.option().parent().should('have.length', 11);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAC').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAD').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAE').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAF').should('be.visible');
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
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B').should('be.visible').click();

    e2e.components.Select.toggleAllOptions().should('have.text', 'Selected (2)');

    cy.get('body').click();

    cy.wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A,B').scrollIntoView().should('be.visible');

    cy.get(`[aria-label="${selectors.components.LoadingIndicator.icon}"]`).should('not.exist');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AA')
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });

    e2e.components.Select.option().should('have.length', 11);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AC').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AD').should('be.visible');

    cy.get('body').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AAA')
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });

    e2e.components.Select.option().should('have.length', 10);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AAA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AAB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AAC').should('be.visible');
  });

  it('removing a value that is part of dependents options should remove the new values dependant options', () => {
    e2e.flows.openDashboard({
      uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=A&var-datacenter=B&var-server=AA&var-server=BB&var-pod=AAA&var-pod=BBB`,
    });
    cy.intercept({ pathname: '/api/ds/query' }).as('query');

    cy.wait('@query');
    cy.get(`[aria-label="${selectors.components.LoadingIndicator.icon}"]`).should('not.exist');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A,B')
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A').should('be.visible').click();

    cy.get('body').click();

    cy.wait('@query');
    cy.get(`[aria-label="${selectors.components.LoadingIndicator.icon}"]`).should('not.exist');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B').should('be.visible');

    cy.get(`[aria-label="${selectors.components.LoadingIndicator.icon}"]`).should('not.exist');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BB')
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });

    e2e.components.Select.option().should('have.length', 10);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').should('be.visible');

    cy.get('body').click(0, 0);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BBB')
      .should('be.visible')
      .within(() => {
        cy.get('input').click();
      });
    e2e.components.Select.option().should('have.length', 10);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBC').should('be.visible');
  });
});
