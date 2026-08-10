import { type Locator, test } from '@playwright/test';

import { PageObject } from '../PageObject';

/**
 * The "Variable options" pane in the sidebar — variable type,
 * name/label inputs, plus type-specific options (e.g. datasource variables)
 */
export class VariableOptions extends PageObject {
  /** Selects the variable type (e.g. "Query", "Custom") in the type picker */
  async selectVariableType(variableType: string) {
    await test.step(`Select variable type "${variableType}"`, async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.PanelEditor.ElementEditPane.variableType(variableType))
        .click();
    });
  }

  /** Sets the variable name */
  async setName(variableName: string) {
    await test.step(`Set variable name to "${variableName}"`, async () => {
      const input = this.dashboardPage.getByGrafanaSelector(
        this.selectors.components.PanelEditor.ElementEditPane.variableNameInput
      );
      await input.click();
      await input.fill(variableName);
      await input.blur();
    });
  }

  /** Sets the variable label */
  async setLabel(variableLabel: string) {
    await test.step(`Set variable label to "${variableLabel}"`, async () => {
      const input = this.dashboardPage.getByGrafanaSelector(
        this.selectors.components.PanelEditor.ElementEditPane.variableLabelInput
      );
      await input.click();
      await input.fill(variableLabel);
      await input.blur();
    });
  }

  /** Selects the variable's display option from the dropdown */
  async selectDisplay(displayLabel: string) {
    await test.step(`Select variable display "${displayLabel}"`, async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.General.generalDisplaySelect)
        .click();
      // the option also renders a description so we can't just use getByRole('option', {name,exact})
      await this.page.getByRole('option').getByText(displayLabel, { exact: true }).click();
    });
  }

  readonly datasource = {
    /**
     * Selects the datasource type the variable lists
     * @param dsType has to match the type exactly (e.g. "prometheus"), as it is entered with the keyboard
     */
    selectType: async (dsType: string) => {
      await test.step(`Select variable datasource type "${dsType}"`, async () => {
        const datasourceSelect = this.dashboardPage.getByGrafanaSelector(
          this.selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect
        );
        await datasourceSelect.fill(dsType);
        await datasourceSelect.press('Enter');
      });
    },
    /** Sets the datasource name filter */
    setNameFilter: async (nameFilter: string) => {
      await test.step(`Set data source name filter "${nameFilter}"`, async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.nameFilter)
          .fill(nameFilter);
      });
    },
  };

  readonly custom = {
    /** Opens the custom variable values editor modal */
    openEditor: async () => {
      await test.step('Open custom variable editor', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.optionsOpenButton)
          .click();
      });
    },
    /** Selects the values format in the editor modal */
    selectFormat: async (format: 'CSV' | 'JSON') => {
      await test.step(`Select "${format}" format`, async () => {
        const modal = this.page.getByRole('dialog');
        await this.dashboardPage
          // <RadioButtonGroup /> auto-applies the RadioGroup container testid; we scope it to the modal
          .getByGrafanaSelector(this.selectors.components.RadioGroup.container, { root: modal })
          .getByRole('radio', { name: format, exact: true })
          .check();
      });
    },
    /** Fills the custom variable values in the currently selected format */
    setValues: async (valuesInSelectedFormat: string) => {
      await test.step('Fill custom variable options', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput)
          .fill(valuesInSelectedFormat);
      });
    },
    /** Returns the preview-of-values options */
    getPreviewOfValues: (): Locator =>
      this.dashboardPage.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
      ),
    /** Returns the preview table, shown instead of the plain values preview when options carry properties beyond value/text */
    getPreviewTable: (): Locator =>
      this.dashboardPage.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.previewTable
      ),
    /** Applies the variable changes */
    clickApplyButton: async () => {
      await test.step('Apply variable changes', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.applyButton)
          .click();
      });
    },
  };

  readonly groupby = {
    /**
     * Selects the group by variable's datasource
     * @param dataSource has to match the datasource name, as it is searched then selected
     */
    selectDatasource: async (dataSource: string) => {
      await test.step(`Select group by datasource "${dataSource}"`, async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.dataSourceSelect)
          .click();

        await this.page.keyboard.type(dataSource);
        await this.page.getByRole('option', { name: dataSource }).click();
      });
    },
  };

  readonly adhoc = {
    /**
     * Selects the ad hoc variable's datasource; waits until the "does not support filters" alert is gone
     * @param dataSource has to match the datasource name, as it is searched then selected
     */
    selectDatasource: async (dataSource: string) => {
      await test.step(`Select ad hoc datasource "${dataSource}"`, async () => {
        await this.dashboardPage
          .getByGrafanaSelector(
            this.selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.datasourceSelect
          )
          .click();

        await this.page.keyboard.type(dataSource);
        await this.page.getByRole('option', { name: dataSource }).click();

        await this.page
          .getByRole('alert', { name: /this data source does not support filters/ })
          .waitFor({ state: 'detached' });
      });
    },
  };

  readonly query = {
    /** Opens the query variable options editor */
    openEditor: async () => {
      await test.step('Open query variable editor', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(
            this.selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsOpenButton
          )
          .click();
      });
    },
    /** Selects the datasource the query runs against */
    selectTargetDatasource: async (dataSource: string) => {
      await test.step(`Select target datasource "${dataSource}"`, async () => {
        await this.components.dataSourcePicker.set(dataSource);
      });
    },
    /** Sets the TestData query */
    setTestDataQuery: async (query: string) => {
      await test.step(`Set TestData query to "${query}"`, async () => {
        await this.dashboardPage
          .getByGrafanaSelector(
            this.selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput
          )
          .fill(query);
      });
    },
    /** Runs the query to preview its values */
    runQuery: async () => {
      await test.step('Run query', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton)
          .click();
      });
    },
    /** Returns the preview-of-values options */
    getPreviewOfValues: (): Locator =>
      this.dashboardPage.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
      ),
    /** Applies the variable changes */
    clickApplyButton: async () => {
      await test.step('Apply variable changes', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.applyButton)
          .click();
      });
    },
  };

  readonly constant = {
    /** Sets the constant variable's value */
    setValue: async (constantValue: string) => {
      await test.step(`Set constant variable value to "${constantValue}"`, async () => {
        const valueInput = this.dashboardPage
          .getByGrafanaSelector(this.selectors.components.PanelEditor.OptionsPane.fieldLabel('variable-type Value'))
          .locator('input');

        await valueInput.fill(constantValue);
        await valueInput.blur();
      });
    },
  };

  readonly textbox = {
    /** Sets the textbox variable's value */
    setValue: async (textboxValue: string) => {
      await test.step(`Set textbox variable value to "${textboxValue}"`, async () => {
        const valueInput = this.dashboardPage
          .getByGrafanaSelector(this.selectors.components.PanelEditor.OptionsPane.fieldLabel('variable-type Value'))
          .locator('input');

        await valueInput.fill(textboxValue);
        await valueInput.blur();
      });
    },
  };

  readonly interval = {
    /** Toggles the interval variable's auto option */
    toggleAuto: async () => {
      await test.step('Toggle auto option for interval variable', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.components.Sidebar.container)
          // there's a checkbox input in the DOM with a proper data-testid, but it's hidden (opacity 0) so Playwright cannot check it
          .getByText('Auto option')
          .click();
      });
    },
  };
}
