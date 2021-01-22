import { e2e } from '@grafana/e2e';

const PAGE_UNDER_TEST = '-Y-tnEDWk';

describe('Variables - Add variable', () => {
  it('query variable should be default and default fields should be correct', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?editview=templating` });

    e2e.pages.Dashboard.Settings.Variables.List.newButton().should('be.visible').click();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInput()
      .should('be.visible')
      .within((input) => {
        expect(input.attr('placeholder')).equals('name');
        expect(input.val()).equals('query0');
      });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelect()
      .should('be.visible')
      .within((select) => {
        e2e.components.Select.singleValue().should('be.visible').should('have.text', 'Query');
      });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput()
      .should('be.visible')
      .within((input) => {
        expect(input.attr('placeholder')).equals('optional display name');
        expect(input.val()).equals('');
      });
    e2e()
      .get('#Description')
      .should('be.visible')
      .within((input) => {
        expect(input.attr('placeholder')).equals('descriptive text');
        expect(input.val()).equals('');
      });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalHideSelect()
      .should('be.visible')
      .within((select) => {
        e2e.components.Select.singleValue().should('have.text', '');
      });

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect()
      .should('be.visible')
      .within((select) => {
        e2e.components.Select.singleValue().should('have.text', 'gdev-testdata');
      });

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelect()
      .should('be.visible')
      .within((select) => {
        e2e.components.Select.singleValue().should('have.text', 'Never');
      });
    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInput()
      .should('be.visible')
      .within((input) => {
        const placeholder = '/.*-(?<text>.*)-(?<value>.*)-.*/';
        expect(input.attr('placeholder')).equals(placeholder);
        expect(input.val()).equals('');
      });
    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelect()
      .should('be.visible')
      .within((select) => {
        e2e.components.Select.singleValue().should('have.text', 'Disabled');
      });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch().should('not.be.checked');
    e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch().should('not.be.checked');

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.valueGroupsTagsEnabledSwitch().should('not.be.checked');

    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should('not.exist');
    e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput().should('not.exist');
  });

  it('adding a single value query variable', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?editview=templating` });

    e2e.pages.Dashboard.Settings.Variables.List.newButton().should('be.visible').click();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput()
      .should('be.visible')
      .clear()
      .type('a label');

    e2e().get('#Description').should('be.visible').clear().type('a description');

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.input().should('be.visible').type('gdev-testdata').type('{enter}');
      });

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput()
      .should('be.visible')
      .type('*')
      .blur();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should('exist');

    e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().should('be.visible').click();

    e2e().wait(500);

    e2e.components.BackButton.backArrow().should('be.visible').click({ force: true });

    e2e.pages.Dashboard.SubMenu.submenuItemLabels('a label').should('be.visible');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A').eq(1).should('be.visible').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e().get('.variable-option').should('have.length', 3);
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C').should('be.visible');
  });

  it('adding a multi value query variable', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?editview=templating` });

    e2e.pages.Dashboard.Settings.Variables.List.newButton().should('be.visible').click();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput()
      .should('be.visible')
      .clear()
      .type('a label');

    e2e().get('#Description').should('be.visible').clear().type('a description');

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.input().should('be.visible').type('gdev-testdata').type('{enter}');
      });

    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput()
      .should('be.visible')
      .type('*')
      .blur();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch()
      .click({ force: true })
      .should('be.checked');

    e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch()
      .click({ force: true })
      .should('be.checked');

    e2e.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput().within((input) => {
      expect(input.attr('placeholder')).equals('blank = auto');
      expect(input.val()).equals('');
    });

    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().should('exist');

    e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().should('be.visible').click();

    e2e().wait(500);

    e2e.components.BackButton.backArrow().should('be.visible').click({ force: true });

    e2e().wait(500);

    e2e.pages.Dashboard.SubMenu.submenuItemLabels('a label').should('be.visible');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A').eq(1).should('be.visible').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown()
      .should('be.visible')
      .within(() => {
        e2e().get('.variable-option').should('have.length', 4);
      });

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B').should('be.visible');
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C').should('be.visible');
  });
});
