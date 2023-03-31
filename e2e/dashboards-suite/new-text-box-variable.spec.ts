import { e2e } from '@grafana/e2e';
import { GrafanaBootConfig } from '@grafana/runtime';

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';

describe('Variables - Text box', () => {
  it('can add a new text box variable', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&editview=templating` });
    e2e().contains(DASHBOARD_NAME).should('be.visible');

    // Create a new "text box" variable
    e2e.components.CallToActionCard.buttonV2('Add variable').click();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2().within(() => {
      e2e().get('input').type('Text box{enter}');
    });
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2().clear().type('VariableUnderTest').blur();
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2().type('Variable under test').blur();
    e2e.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInputV2().type('cat-dog').blur();

    e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption().eq(0).should('have.text', 'cat-dog');

    // Navigate back to the homepage and change the selected variable value
    e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().click();
    e2e()
      .window()
      .then((win: Cypress.AUTWindow & { grafanaBootData: GrafanaBootConfig['bootData'] }) => {
        if (win.grafanaBootData.settings.featureToggles.topnav) {
          e2e.pages.Dashboard.Settings.Actions.close().click();
        } else {
          e2e.components.BackButton.backArrow().click({ force: true });
        }
      });
    e2e().get('#var-VariableUnderTest').clear().type('dog-cat').blur();

    // Assert it was rendered
    e2e().get('.markdown-html').should('include.text', 'VariableUnderTest: dog-cat');
  });
});
