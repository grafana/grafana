import { e2e } from '@grafana/e2e';
import { GrafanaBootConfig } from '@grafana/runtime';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

function fillInCustomVariable(name: string, label: string, value: string) {
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2().within(() => {
    e2e().get('input').type('Custom{enter}');
  });
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2().clear().type(name).blur();
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2().type(label).blur();
  e2e.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput().type(value).blur();
}

function assertPreviewValues(expectedValues: string[]) {
  for (const expected of expectedValues) {
    const index = expectedValues.indexOf(expected);
    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().eq(index).should('have.text', expected);
  }
}

describe('Variables - Custom', () => {
  it('can add a custom template variable', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });

    // Create a new "Custom" variable
    e2e.components.CallToActionCard.buttonV2('Add variable').click();
    fillInCustomVariable('VariableUnderTest', 'Variable under test', 'one,two,three');
    assertPreviewValues(['one', 'two', 'three']);

    // Navigate back to the homepage and change the selected variable value
    e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().click();
    e2e()
      .window()
      .then((win: Cypress.AUTWindow & { grafanaBootData: GrafanaBootConfig['bootData'] }) => {
        if (win.grafanaBootData.settings.featureToggles.topnav) {
          e2e.components.Breadcrumbs.breadcrumb(DASHBOARD_NAME).click();
        } else {
          e2e.components.BackButton.backArrow().click({ force: true });
        }
      });
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('one').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('two').click();

    // Assert it was rendered
    e2e().get('.markdown-html').should('include.text', 'VariableUnderTest: two');
  });

  it('can add a custom template variable with labels', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });

    // Create a new "Custom" variable
    e2e.components.CallToActionCard.buttonV2('Add variable').click();
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2().within(() => {
      e2e().get('input').type('Custom{enter}');
    });

    // Set its name, label, and content
    fillInCustomVariable('VariableUnderTest', 'Variable under test', 'One : 1,Two : 2, Three : 3');
    assertPreviewValues(['One', 'Two', 'Three']);

    // Navigate back to the homepage and change the selected variable value
    e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().click();
    e2e()
      .window()
      .then((win: Cypress.AUTWindow & { grafanaBootData: GrafanaBootConfig['bootData'] }) => {
        if (win.grafanaBootData.settings.featureToggles.topnav) {
          e2e.components.Breadcrumbs.breadcrumb('Test variable output').click();
        } else {
          e2e.components.BackButton.backArrow().click({ force: true });
        }
      });
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('One').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('Two').click();

    // Assert it was rendered
    e2e().get('.markdown-html').should('include.text', 'VariableUnderTest: 2');
  });
});
