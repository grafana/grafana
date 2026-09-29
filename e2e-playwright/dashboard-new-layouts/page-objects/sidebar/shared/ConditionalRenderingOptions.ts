import { type Locator, test } from '@playwright/test';

import { PageObject } from '../../PageObject';

type ConditionalRenderingRuleId = 'data' | 'timeRangeSize' | 'variable';

/**
 * The conditional rendering ("Show / hide rules") options in the sidebar pane —
 * visibility toggle, match all/any, and the rule builder (variable, time range, query result)
 */
export class ConditionalRenderingOptions extends PageObject {
  /** Returns the Show / Hide visibility radio */
  getVisibilityRadio(visibility: 'show' | 'hide'): Locator {
    return this.getByGrafanaSelector(this.selectors.components.Sidebar.container)
      .getByTestId(this.selectors.components.RadioButton.container)
      .getByRole('radio', { name: visibility === 'show' ? 'Show' : 'Hide' });
  }

  /** Selects whether matching rules show or hide the element */
  async selectVisibility(visibility: 'show' | 'hide') {
    await test.step(`Select conditional rendering visibility: "${visibility}"`, async () => {
      await this.getVisibilityRadio(visibility)
        // RadioButton styles the <input> with opacity:0; Playwright treats that as hidden
        .click({ force: true });
    });
  }

  /** Returns the Match type radio (Match all / Match any) */
  getMatchTypeRadio(matchType: 'all' | 'any'): Locator {
    return this.getByGrafanaSelector(this.selectors.components.Sidebar.container)
      .getByTestId(this.selectors.components.RadioButton.container)
      .getByRole('radio', { name: matchType === 'all' ? 'Match all' : 'Match any' });
  }

  /** Selects whether all rules or any rule must match */
  async selectMatchType(matchType: 'all' | 'any') {
    await test.step(`Select conditional rendering match: "Match ${matchType}"`, async () => {
      await this.getMatchTypeRadio(matchType)
        // RadioButton styles the <input> with opacity:0; Playwright treats that as hidden
        .click({ force: true });
    });
  }

  /** Returns the wrapper for a Query result, Time range, or Template variable rule */
  getRule(ruleId: ConditionalRenderingRuleId): Locator {
    return this.getByGrafanaSelector(this.selectors.pages.Dashboard.Sidebar.conditionalRendering.rule(ruleId));
  }

  /** Removes a rule by type (Query result, Time range, or Template variable) */
  async removeRule(ruleId: ConditionalRenderingRuleId) {
    await test.step(`Remove conditional rendering rule: "${ruleId}"`, async () => {
      await this.getRule(ruleId).getByRole('button', { name: 'Delete Condition' }).click();
    });
  }

  /** Returns the "+ Add rule" button */
  getAddRuleButton(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.ValuePicker.button('Add rule'));
  }

  readonly templateVariable = {
    /** Returns the "Template variable" name combobox */
    getRuleNameSelect: (): Locator => {
      return this.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Sidebar.conditionalRendering.variable.variableSelection,
        { root: this.getRule('variable') }
      );
    },
    /** Returns the "Template variable" operator combobox */
    getRuleOperatorSelect: (): Locator => {
      return this.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Sidebar.conditionalRendering.variable.operatorSelection,
        { root: this.getRule('variable') }
      );
    },
    /** Returns the "Template variable" value input */
    getRuleValueInput: (): Locator => {
      return this.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Sidebar.conditionalRendering.variable.valueInput,
        {
          root: this.getRule('variable'),
        }
      );
    },
    /**
     * Adds a "Template variable" rule with the given variable, operator, and value
     * @param operator has to match the operator text exactly (e.g. "=")
     */
    addRule: async (variableName: string, operator: string, variableValue: string) => {
      await test.step(`Add variable conditional rendering rule: "${variableName}${operator}${variableValue}"`, async () => {
        await this.getAddRuleButton().click();

        // ValuePicker opens a react-select listbox (portaled to body), not a dialog
        await this.page.getByRole('listbox').getByRole('option', { name: 'Template variable' }).click();

        // select variable by name
        await this.templateVariable.getRuleNameSelect().click();
        await this.page.getByRole('listbox').getByRole('option', { name: variableName, exact: true }).click();

        // select operator
        await this.templateVariable.getRuleOperatorSelect().click();
        // option also renders a description (e.g. "Equals"), so match the operator text exactly
        await this.page.getByRole('listbox').getByRole('option').getByText(operator, { exact: true }).click();

        // set value
        const valueInput = this.templateVariable.getRuleValueInput();
        await valueInput.fill(variableValue);
        await valueInput.blur();
      });
    },
  };

  readonly timeRange = {
    /** Returns the "Time range less than" rule combobox */
    getRuleSelect: (): Locator => {
      return this.getByGrafanaSelector(this.selectors.pages.Dashboard.Sidebar.conditionalRendering.timeRange.select, {
        root: this.getRule('timeRangeSize'),
      });
    },
    /**
     * Adds a "Time range less than" rule
     * @param optionLabel the label of the duration option to select (e.g. "12 hours")
     */
    addRule: async (optionLabel: string) => {
      await test.step(`Add time range conditional rendering rule: "less than ${optionLabel}"`, async () => {
        await this.getAddRuleButton().click();
        // ValuePicker opens a react-select listbox (portaled to body), not a dialog
        await this.page.getByRole('listbox').getByRole('option', { name: 'Time range less than' }).click();

        await this.timeRange.getRuleSelect().click();
        await this.page.getByRole('listbox').getByRole('option', { name: optionLabel, exact: true }).click();
      });
    },
  };

  readonly queryResult = {
    /** Returns the "Query result" rule combobox (Has data / No data) */
    getRuleSelect: (): Locator => {
      return this.getByGrafanaSelector(this.selectors.pages.Dashboard.Sidebar.conditionalRendering.data.select, {
        root: this.getRule('data'),
      });
    },
    /**
     * Adds a "Query result" rule
     * @param optionLabel the label of result option to select
     */
    addRule: async (optionLabel: 'Has data' | 'No data') => {
      await test.step(`Add query result conditional rendering rule: "${optionLabel}"`, async () => {
        await this.getAddRuleButton().click();
        await this.page.getByRole('listbox').getByRole('option', { name: 'Query result' }).click();
        await this.queryResult.getRuleSelect().click();
        await this.page.getByRole('listbox').getByRole('option', { name: optionLabel }).click();
      });
    },
  };
}
