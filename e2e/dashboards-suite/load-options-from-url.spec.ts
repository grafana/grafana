import { e2e } from '@grafana/e2e';

const PAGE_UNDER_TEST = '-Y-tnEDWk/templating-nested-template-variables';

describe('Variables - Load options from Url', () => {
  it('default options should be correct', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });
    e2e()
      .intercept({
        method: 'POST',
        url: '/api/ds/query',
      })
      .as('query');

    e2e().wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A').should('be.visible').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e.components.Variables.variableOption().should('have.length', 9);
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C').should('be.visible');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AA').should('be.visible').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e.components.Variables.variableOption().should('have.length', 9);
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AC').should('be.visible');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All').should('be.visible').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e.components.Variables.variableOption().should('have.length', 9);
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AAA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AAB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AAC').should('be.visible');
  });

  it('options set in url should load correct options', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=B&var-server=BB&var-pod=BBB` });
    e2e()
      .intercept({
        method: 'POST',
        url: '/api/ds/query',
      })
      .as('query');

    e2e().wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B').should('be.visible').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e.components.Variables.variableOption().should('have.length', 9);
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C').should('be.visible');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BB').should('be.visible').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e.components.Variables.variableOption().should('have.length', 9);
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').should('be.visible');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BBB').should('be.visible').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e.components.Variables.variableOption().should('have.length', 9);
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBC').should('be.visible');
  });

  it('options set in url that do not exist should load correct options', () => {
    e2e.flows.login('admin', 'admin');
    // @ts-ignore some typing issue
    e2e().on('uncaught:exception', (err) => {
      if (err.stack?.indexOf("Couldn't find any field of type string in the results.") !== -1) {
        // return false to prevent the error from
        // failing this test
        return false;
      }

      return true;
    });

    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=X` });
    e2e()
      .intercept({
        method: 'POST',
        url: '/api/ds/query',
      })
      .as('query');

    e2e().wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('X').should('be.visible').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e.components.Variables.variableOption().should('have.length', 9);
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C').should('be.visible');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AA').should('be.visible').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e.components.Variables.variableOption().should('have.length', 65);
      });
  });
});
