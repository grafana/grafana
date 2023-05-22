import { e2e } from '@grafana/e2e';
import { GrafanaBootConfig } from '@grafana/runtime';

const PAGE_UNDER_TEST = '-Y-tnEDWk/templating-nested-template-variables';

describe('Variables - Query - Add variable', () => {
  it('query variable should be default and default fields should be correct', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });

    e2e.pages.Dashboard.Settings.Variables.List.newButton().should('be.visible').click();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2()
      .should('be.visible')
      .within((input) => {
        expect(input.attr('placeholder')).equals('Variable name');
        expect(input.val()).equals('query0');
      });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2()
      .should('be.visible')
      .within((select) => {
        e2e.components.Select.singleValue().should('have.text', 'Query');
      });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2()
      .should('be.visible')
      .within((input) => {
        expect(input.attr('placeholder')).equals('Label name');
        expect(input.val()).equals('');
      });
    e2e()
      .get('[placeholder="Descriptive text"]')
      .should('be.visible')
      .within((input) => {
        expect(input.attr('placeholder')).equals('Descriptive text');
        expect(input.val()).equals('');
      });
    e2e().get('label').contains('Show on dashboard').should('be.visible');

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect()
      .should('be.visible')
      .within((select) => {
        e2e.components.Select.singleValue().should('have.text', 'gdev-testdata');
      });

    e2e().get('label').contains('Refresh').scrollIntoView().should('be.visible');
    e2e().get('label').contains('On dashboard load').scrollIntoView().should('be.visible');

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2()
      .should('be.visible')
      .within((input) => {
        const placeholder = '/.*-(?<text>.*)-(?<value>.*)-.*/';
        expect(input.attr('placeholder')).equals(placeholder);
        expect(input.val()).equals('');
      });
    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelectV2()
      .should('be.visible')
      .within((select) => {
        e2e.components.Select.singleValue().should('have.text', 'Disabled');
      });

    e2e()
      .contains('label', 'Multi-value')
      .within(() => {
        e2e().get('input[type="checkbox"]').should('not.be.checked');
      });

    e2e()
      .contains('label', 'Include All option')
      .within(() => {
        e2e().get('input[type="checkbox"]').should('not.be.checked');
      });

    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should('not.exist');
    e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInputV2().should('not.exist');
  });

  it('adding a single value query variable', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });

    e2e.pages.Dashboard.Settings.Variables.List.newButton().should('be.visible').click();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2()
      .should('be.visible')
      .clear()
      .type('a label');

    e2e().get('[placeholder="Descriptive text"]').should('be.visible').clear().type('a description');

    e2e.components.DataSourcePicker.inputV2().should('be.visible').type('gdev-testdata{enter}');

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput()
      .should('be.visible')
      .type('*')
      .blur();

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2()
      .should('be.visible')
      .type('/.*C.*/')
      .blur();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should('exist');

    e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().scrollIntoView().should('be.visible').click();

    e2e()
      .window()
      .then((win: Cypress.AUTWindow & { grafanaBootData: GrafanaBootConfig['bootData'] }) => {
        if (win.grafanaBootData.settings.featureToggles.topnav) {
          e2e.pages.Dashboard.Settings.Actions.close().click();
        } else {
          e2e.components.BackButton.backArrow().click({ force: true });
        }
      });

    e2e.pages.Dashboard.SubMenu.submenuItemLabels('a label').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItem()
      .should('have.length', 4)
      .eq(3)
      .within(() => {
        e2e().get('.variable-link-wrapper').should('be.visible').click();
        e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
          .should('be.visible')
          .within(() => {
            e2e.components.Variables.variableOption().should('have.length', 1);
          });

        e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C').should('be.visible');
      });
  });

  it('adding a multi value query variable', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });

    e2e.pages.Dashboard.Settings.Variables.List.newButton().should('be.visible').click();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2()
      .should('be.visible')
      .clear()
      .type('a label');

    e2e().get('[placeholder="Descriptive text"]').should('be.visible').clear().type('a description');

    e2e.components.DataSourcePicker.inputV2().type('gdev-testdata{enter}');

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput()
      .should('be.visible')
      .type('*')
      .blur();

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2()
      .should('be.visible')
      .type('/.*C.*/')
      .blur();

    e2e()
      .contains('label', 'Multi-value')
      .within(() => {
        e2e().get('input[type="checkbox"]').click({ force: true }).should('be.checked');
      });

    e2e()
      .contains('label', 'Include All option')
      .within(() => {
        e2e().get('input[type="checkbox"]').click({ force: true }).should('be.checked');
      });

    e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInputV2().within((input) => {
      expect(input.attr('placeholder')).equals('blank = auto');
      expect(input.val()).equals('');
    });

    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should('exist');

    e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().scrollIntoView().should('be.visible').click();

    e2e()
      .window()
      .then((win: Cypress.AUTWindow & { grafanaBootData: GrafanaBootConfig['bootData'] }) => {
        if (win.grafanaBootData.settings.featureToggles.topnav) {
          e2e.pages.Dashboard.Settings.Actions.close().click();
        } else {
          e2e.components.BackButton.backArrow().click({ force: true });
        }
      });

    e2e.pages.Dashboard.SubMenu.submenuItemLabels('a label').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItem()
      .should('have.length', 4)
      .eq(3)
      .within(() => {
        e2e().get('.variable-link-wrapper').should('be.visible').click();
        e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
          .should('be.visible')
          .within(() => {
            e2e.components.Variables.variableOption().should('have.length', 2);
          });

        e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
        e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C').should('be.visible');
      });
  });
});
