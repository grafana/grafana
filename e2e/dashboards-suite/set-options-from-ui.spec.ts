import { e2e } from '@grafana/e2e';
import { GrafanaBootConfig } from '@grafana/runtime';

const PAGE_UNDER_TEST = '-Y-tnEDWk/templating-nested-template-variables';

describe('Variables - Set options from ui', () => {
  it('clicking a value that is not part of dependents options should change these to All', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=A&var-server=AA&var-pod=AAA` });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A').should('be.visible').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A').should('be.visible').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B').should('be.visible').click();

    e2e()
      .window()
      .then((win: Cypress.AUTWindow & { grafanaBootData: GrafanaBootConfig['bootData'] }) => {
        if (win.grafanaBootData.settings.featureToggles.topnav) {
          e2e.components.NavToolbar.container().click();
        } else {
          e2e.components.PageToolbar.container().click();
        }
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B').scrollIntoView().should('be.visible');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
      .should('have.length', 2)
      .eq(0)
      .should('be.visible')
      .click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e.components.Variables.variableOption().should('have.length', 9);
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').should('be.visible');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All').should('be.visible').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e.components.Variables.variableOption().should('have.length', 65);
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAC').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAD').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAE').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAF').should('be.visible');
  });

  it('adding a value that is not part of dependents options should add the new values dependant options', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=A&var-server=AA&var-pod=AAA` });
    e2e().intercept('/api/ds/query').as('query');

    e2e().wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A').should('be.visible').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B').should('be.visible').click();

    e2e()
      .window()
      .then((win: Cypress.AUTWindow & { grafanaBootData: GrafanaBootConfig['bootData'] }) => {
        if (win.grafanaBootData.settings.featureToggles.topnav) {
          e2e.components.NavToolbar.container().click();
        } else {
          e2e.components.PageToolbar.container().click();
        }
      });

    e2e().wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A + B').scrollIntoView().should('be.visible');

    e2e.components.LoadingIndicator.icon().should('have.length', 0);

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AA').should('be.visible').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e.components.Variables.variableOption().should('have.length', 17);
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AC').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC').should('be.visible');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AAA').should('be.visible').click();

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

  it('removing a value that is part of dependents options should remove the new values dependant options', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({
      uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=A&var-datacenter=B&var-server=AA&var-server=BB&var-pod=AAA&var-pod=BBB`,
    });
    e2e().intercept('/api/ds/query').as('query');

    e2e().wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A + B').should('be.visible').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A').should('be.visible').click();

    e2e()
      .window()
      .then((win: Cypress.AUTWindow & { grafanaBootData: GrafanaBootConfig['bootData'] }) => {
        if (win.grafanaBootData.settings.featureToggles.topnav) {
          e2e.components.NavToolbar.container().click();
        } else {
          e2e.components.PageToolbar.container().click();
        }
      });

    e2e().wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B').scrollIntoView().should('be.visible');

    e2e.components.LoadingIndicator.icon().should('have.length', 0);

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

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBA').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBB').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBC').should('be.visible');
  });
});
