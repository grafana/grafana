import { e2e } from '../utils';

const PAGE_UNDER_TEST = '-Y-tnEDWk/templating-nested-template-variables';
const DASHBOARD_NAME = 'Templating - Nested Template Variables';

describe('Variables - Query - Add variable', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('query variable should be default and default fields should be correct', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

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
    cy.get('[placeholder="Descriptive text"]')
      .should('be.visible')
      .within((input) => {
        expect(input.attr('placeholder')).equals('Descriptive text');
        expect(input.val()).equals('');
      });
    cy.get('label').contains('Show on dashboard').should('be.visible');

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect()
      .get('input[placeholder="gdev-testdata"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get('label').contains('Refresh').scrollIntoView().should('be.visible');
    cy.get('label').contains('On dashboard load').scrollIntoView().should('be.visible');

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

    cy.contains('label', 'Multi-value').within(() => {
      cy.get('input[type="checkbox"]').should('not.be.checked');
    });

    cy.contains('label', 'Include All option').within(() => {
      cy.get('input[type="checkbox"]').should('not.be.checked');
    });

    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should('not.exist');
    e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput().should('not.exist');
  });

  it('adding a single value query variable', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    e2e.pages.Dashboard.Settings.Variables.List.newButton().should('be.visible').click();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2()
      .should('be.visible')
      .clear()
      .type('a label');

    cy.get('[placeholder="Descriptive text"]').should('be.visible').clear().type('a description');

    e2e.components.DataSourcePicker.container().should('be.visible').type('gdev-testdata{enter}');

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

    e2e.pages.Dashboard.Settings.Actions.close().click();

    e2e.pages.Dashboard.SubMenu.submenuItemLabels('a label').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItem()
      .should('have.length', 4)
      .eq(3)
      .within(() => {
        e2e.components.Variables.variableLinkWrapper().should('be.visible').click();
        e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
          .should('be.visible')
          .within(() => {
            e2e.components.Variables.variableOption().should('have.length', 1);
          });

        e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C').should('be.visible');
      });
  });

  it('adding a multi value query variable', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });
    cy.contains(DASHBOARD_NAME).should('be.visible');

    e2e.pages.Dashboard.Settings.Variables.List.newButton().should('be.visible').click();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2()
      .should('be.visible')
      .clear()
      .type('a label');

    cy.get('[placeholder="Descriptive text"]').should('be.visible').clear().type('a description');

    e2e.components.DataSourcePicker.container().type('gdev-testdata{enter}');

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput()
      .should('be.visible')
      .type('*')
      .blur();

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2()
      .should('be.visible')
      .type('/.*C.*/')
      .blur();

    cy.contains('label', 'Multi-value').within(() => {
      cy.get('input[type="checkbox"]').click({ force: true }).should('be.checked');
    });

    cy.contains('label', 'Include All option').within(() => {
      cy.get('input[type="checkbox"]').click({ force: true }).should('be.checked');
    });

    e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput().within((input) => {
      expect(input.val()).equals('');
    });

    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should('exist');

    e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().scrollIntoView().should('be.visible').click();

    e2e.pages.Dashboard.Settings.Actions.close().click();

    e2e.pages.Dashboard.SubMenu.submenuItemLabels('a label').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItem()
      .should('have.length', 4)
      .eq(3)
      .within(() => {
        e2e.components.Variables.variableLinkWrapper().should('be.visible').click();
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
