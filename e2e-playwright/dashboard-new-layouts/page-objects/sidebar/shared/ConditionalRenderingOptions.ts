import { test } from '@playwright/test';

import { PageObject } from '../../PageObject';

// The conditional rendering ("Show / hide rules") options in the sidebar pane —
// visibility toggle, match all/any, and the rule builder (variable, time range)
export class ConditionalRenderingOptions extends PageObject {
  async selectVisibility(visibility: 'show' | 'hide') {
    await test.step(`Select conditional rendering visibility: "${visibility}"`, async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.RadioButton.container, {
          root: this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.container),
        })
        .getByRole('radio', { name: visibility === 'show' ? 'Show' : 'Hide' })
        // RadioButton styles the <input> with opacity:0; Playwright treats that as hidden
        .click({ force: true });
    });
  }

  async selectMatch(matchType: 'all' | 'any') {
    await test.step(`Select conditional rendering match: "Match ${matchType}"`, async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.RadioButton.container, {
          root: this.dashboardPage.getByGrafanaSelector(this.selectors.components.Sidebar.container),
        })
        .getByRole('radio', { name: matchType === 'all' ? 'Match all' : 'Match any' })
        // RadioButton styles the <input> with opacity:0; Playwright treats that as hidden
        .click({ force: true });
    });
  }

  async addVariableRule(name: string, operator: string, value: string) {
    await test.step(`Add variable conditional rendering rule: "${name}${operator}${value}"`, async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.ValuePicker.button('Add rule')).click();

      // ValuePicker opens a react-select listbox (portaled to body), not a dialog
      await this.page.getByRole('listbox').getByRole('option', { name: 'Template variable' }).click();

      // select variable by name
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.pages.Dashboard.Sidebar.conditionalRendering.variable.variableSelection)
        .click();
      await this.page.getByRole('listbox').getByRole('option', { name, exact: true }).click();

      // select operator
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.pages.Dashboard.Sidebar.conditionalRendering.variable.operatorSelection)
        .click();
      // option also renders a description (e.g. "Equals"), so match the operator text exactly
      await this.page.getByRole('listbox').getByRole('option').getByText(operator, { exact: true }).click();

      // set value
      const valueInput = this.dashboardPage.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Sidebar.conditionalRendering.variable.valueInput
      );
      await valueInput.fill(value);
      await valueInput.blur();
    });
  }

  async addTimeRangeRule(lessThan: string) {
    await test.step(`Add timerange conditional rendering rule: "less than ${lessThan}"`, async () => {
      await this.dashboardPage.getByGrafanaSelector(this.selectors.components.ValuePicker.button('Add rule')).click();
      // ValuePicker opens a react-select listbox (portaled to body), not a dialog
      await this.page.getByRole('listbox').getByRole('option', { name: 'Time range less than' }).click();

      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.pages.Dashboard.Sidebar.conditionalRendering.timeRange.select)
        .click();
      await this.page.getByRole('listbox').getByRole('option', { name: lessThan }).click();
    });
  }
}
