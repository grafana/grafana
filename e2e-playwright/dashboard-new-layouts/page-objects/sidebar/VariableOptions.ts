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
      await this.getByGrafanaSelector(
        this.selectors.components.PanelEditor.ElementEditPane.variableType(variableType)
      ).click();
    });
  }

  /** Returns the variable name input */
  getNameInput(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.PanelEditor.ElementEditPane.variableNameInput);
  }

  /** Sets the variable name */
  async setName(variableName: string) {
    await test.step(`Set variable name to "${variableName}"`, async () => {
      const input = this.getNameInput();
      await input.fill(variableName);
      await input.blur();
    });
  }

  /** Returns the variable label input */
  getLabelInput(): Locator {
    return this.getByGrafanaSelector(this.selectors.components.PanelEditor.ElementEditPane.variableLabelInput);
  }

  /** Sets the variable label */
  async setLabel(variableLabel: string) {
    await test.step(`Set variable label to "${variableLabel}"`, async () => {
      const input = this.getLabelInput();
      await input.click();
      await input.fill(variableLabel);
      await input.blur();
    });
  }

  /** Selects the variable's display option from the dropdown */
  async selectDisplay(displayLabel: string) {
    await test.step(`Select variable display "${displayLabel}"`, async () => {
      await this.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.General.generalDisplaySelect
      ).click();
      // the option also renders a description so we can't just use getByRole('option', {name,exact})
      await this.page.getByRole('option').getByText(displayLabel, { exact: true }).click();
    });
  }

  readonly datasource = {
    /** Returns the datasource type combobox input; its value is the selected type's name */
    getTypeInput: (): Locator =>
      this.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect,
        { root: this.getByGrafanaSelector(this.selectors.components.Sidebar.container) }
      ),
    /**
     * Selects the datasource type the variable lists
     * @param dsType the type's display name (e.g. "Prometheus"), as it is typed to filter the options then picked
     */
    selectType: async (dsType: string) => {
      await test.step(`Select variable datasource type "${dsType}"`, async () => {
        await this.datasource.getTypeInput().fill(dsType);
        await this.page.getByRole('listbox').getByRole('option', { name: dsType, exact: true }).click();
      });
    },
    /** Returns the datasource name filter input */
    getNameFilterInput: (): Locator =>
      this.getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.nameFilter, {
        root: this.getByGrafanaSelector(this.selectors.components.Sidebar.container),
      }),
    /** Sets the datasource name filter; the field applies it on blur */
    setNameFilter: async (nameFilter: string) => {
      await test.step(`Set data source name filter "${nameFilter}"`, async () => {
        const nameFilterInput = this.datasource.getNameFilterInput();
        await nameFilterInput.fill(nameFilter);
        await nameFilterInput.blur();
      });
    },
    /** Returns the sidebar's preview-of-values options, i.e. the data sources the variable lists */
    getPreviewOfValues: (): Locator =>
      this.getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption, {
        root: this.getByGrafanaSelector(this.selectors.components.Sidebar.container),
      }),
  };

  readonly custom = {
    /** Opens the custom variable values editor modal */
    openEditor: async () => {
      await test.step('Open custom variable editor', async () => {
        await this.getByGrafanaSelector(
          this.selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.optionsOpenButton
        ).click();
      });
    },
    /** Returns the values format radio in the editor modal */
    getFormatRadio: (format: 'CSV' | 'JSON'): Locator =>
      // <RadioButtonGroup /> auto-applies the RadioGroup container testid; we scope it to the modal
      this.page
        .getByRole('dialog')
        .getByTestId(this.selectors.components.RadioGroup.container)
        .getByRole('radio', { name: format, exact: true }),
    /** Selects the values format in the editor modal */
    selectFormat: async (format: 'CSV' | 'JSON') => {
      await test.step(`Select "${format}" format`, async () => {
        await this.custom.getFormatRadio(format).check();
      });
    },
    /** Returns the custom variable values textarea in the editor modal */
    getValuesInput: (): Locator =>
      this.getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput),
    /** Fills the custom variable values in the currently selected format */
    setValues: async (valuesInSelectedFormat: string) => {
      await test.step('Fill custom variable options', async () => {
        await this.custom.getValuesInput().fill(valuesInSelectedFormat);
      });
    },
    /** Returns the preview-of-values options */
    getPreviewOfValues: (): Locator =>
      this.getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption),
    /** Returns the preview table, shown instead of the plain values preview when options carry properties beyond value/text */
    getPreviewTable: (): Locator =>
      this.getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.previewTable),
    /** Applies the variable changes */
    applyChanges: async () => {
      await test.step('Apply variable changes', async () => {
        await this.getByGrafanaSelector(
          this.selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.applyButton
        ).click();
      });
    },
  };

  readonly groupby = {
    /** Returns the datasource picker input; it shows the selected datasource as its placeholder, not its value */
    getDatasourceInput: (): Locator =>
      this.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.dataSourceSelect,
        {
          root: this.getByGrafanaSelector(this.selectors.components.Sidebar.container),
        }
      ),
    /**
     * Selects the group by variable's datasource
     * @param dataSource has to match the datasource name, as it is searched then selected
     */
    selectDatasource: async (dataSource: string) => {
      await test.step(`Select group by datasource "${dataSource}"`, async () => {
        await this.groupby.getDatasourceInput().click();

        await this.page.keyboard.type(dataSource);
        await this.page.getByRole('option', { name: dataSource }).click();
      });
    },
  };

  readonly adhoc = {
    /** Returns the datasource picker input; it shows the selected datasource as its placeholder, not its value */
    getDatasourceInput: (): Locator =>
      this.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.datasourceSelect,
        { root: this.getByGrafanaSelector(this.selectors.components.Sidebar.container) }
      ),
    /**
     * Selects the ad hoc variable's datasource; waits until the "does not support filters" alert is gone
     * @param dataSource has to match the datasource name, as it is searched then selected
     */
    selectDatasource: async (dataSource: string) => {
      await test.step(`Select ad hoc datasource "${dataSource}"`, async () => {
        await this.adhoc.getDatasourceInput().click();

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
        await this.getByGrafanaSelector(
          this.selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsOpenButton,
          { root: this.getByGrafanaSelector(this.selectors.components.Sidebar.container) }
        ).click();
      });
    },
    /** Returns the query variable editor modal; it is portalled, so editor lookups are scoped to it rather than the sidebar */
    getEditor: (): Locator => this.page.getByRole('dialog', { name: /^Query variable: / }),
    /** Returns the editor's datasource picker input; it shows the selected datasource as its placeholder, not its value */
    getTargetDatasourceInput: (): Locator =>
      this.getByGrafanaSelector(this.selectors.components.DataSourcePicker.inputV2, {
        root: this.query.getEditor(),
      }),
    /** Selects the datasource the query runs against */
    selectTargetDatasource: async (dataSource: string) => {
      await test.step(`Select target datasource "${dataSource}"`, async () => {
        // same keyboard sequence as plugin-e2e's DataSourcePicker.set(), which only scopes to the whole page
        await this.query.getTargetDatasourceInput().fill(dataSource);
        await this.page.keyboard.press('ArrowDown');
        await this.page.keyboard.press('ArrowUp');
        await this.page.keyboard.press('Enter');
      });
    },
    /** Returns the query input of datasources using the standard variable query editor (e.g. TestData) */
    getTestDataQueryInput: (): Locator =>
      this.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput,
        { root: this.query.getEditor() }
      ),
    /** Sets the TestData query; the editor applies it on blur */
    setTestDataQuery: async (query: string) => {
      await test.step(`Set TestData query to "${query}"`, async () => {
        const queryInput = this.query.getTestDataQueryInput();
        await queryInput.fill(query);
        await queryInput.blur();
      });
    },
    /** Returns the editor's "Static options (<count>)" tab */
    getStaticOptionsTab: (): Locator => this.query.getEditor().getByRole('tab', { name: /^Static options \(\d+\)$/ }),
    /** Opens the editor's static options tab */
    openStaticOptionsTab: async () => {
      await test.step('Open static options tab', async () => {
        await this.query.getStaticOptionsTab().click();
      });
    },
    /** Returns the static options spreadsheet (the static options tab must be open) */
    getStaticOptionsSpreadsheet: (): Locator =>
      this.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.spreadsheet,
        {
          root: this.query.getEditor(),
        }
      ),
    /** Returns the static options spreadsheet rows, in display order (the static options tab must be open) */
    getStaticOptionRows: (): Locator =>
      this.query
        .getStaticOptionsSpreadsheet()
        .getByTestId(this.selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.spreadsheetRow),
    /**
     * Returns the static option inputs of a property column
     * @param property the column's option property (e.g. "value", "text"), which each cell input uses as its placeholder
     * @param row a row from `getStaticOptionRows()` to read a single option
     */
    getStaticOptionInputs: (property: string, row?: Locator): Locator =>
      (row ?? this.query.getStaticOptionRows()).getByPlaceholder(property, { exact: true }),
    /** Adds a static option at the end of the list (the static options tab must be open) */
    addStaticOption: async (value: string, text: string) => {
      await test.step(`Add static option "${value}" / "${text}"`, async () => {
        await this.query
          .getStaticOptionsSpreadsheet()
          .getByTestId(this.selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.addButton)
          .click();

        const newRow = this.query.getStaticOptionRows().last();
        await this.query.getStaticOptionInputs('value', newRow).fill(value);
        await this.query.getStaticOptionInputs('text', newRow).fill(text);
      });
    },
    /** Runs the query to preview its values */
    runQuery: async () => {
      await test.step('Run query', async () => {
        // the editor renders one of two "Run query" buttons (before / after the first run), never both
        await this.getByGrafanaSelector(
          this.selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton,
          { root: this.query.getEditor() }
        ).click();
      });
    },
    /** Returns the preview-of-values options; options carrying properties beyond value/text render as a table instead */
    getPreviewOfValues: (): Locator =>
      this.getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption, {
        root: this.query.getEditor(),
      }),
    /** Applies the variable changes */
    applyChanges: async () => {
      await test.step('Apply variable changes', async () => {
        await this.getByGrafanaSelector(
          this.selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.applyButton,
          { root: this.query.getEditor() }
        ).click();
      });
    },
  };

  readonly constant = {
    /** Returns the constant variable's value input */
    getValueInput: (): Locator =>
      this.getByGrafanaSelector(
        this.selectors.components.PanelEditor.OptionsPane.fieldLabel('variable-type Value')
      ).locator('input'),
    /** Sets the constant variable's value */
    setValue: async (constantValue: string) => {
      await test.step(`Set constant variable value to "${constantValue}"`, async () => {
        const valueInput = this.constant.getValueInput();

        await valueInput.fill(constantValue);
        await valueInput.blur();
      });
    },
  };

  readonly textbox = {
    /** Returns the textbox variable's value input */
    getValueInput: (): Locator =>
      this.getByGrafanaSelector(
        this.selectors.components.PanelEditor.OptionsPane.fieldLabel('variable-type Value')
      ).locator('input'),
    /** Sets the textbox variable's value */
    setValue: async (textboxValue: string) => {
      await test.step(`Set textbox variable value to "${textboxValue}"`, async () => {
        const valueInput = this.textbox.getValueInput();

        await valueInput.fill(textboxValue);
        await valueInput.blur();
      });
    },
  };

  readonly interval = {
    /** Returns the interval variable's comma-separated "Values" input */
    getValuesInput: (): Locator =>
      this.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.intervalsValueInput
      ),
    /** Sets the interval values; the field applies them on blur */
    setValues: async (intervals: string) => {
      await test.step(`Set interval values to "${intervals}"`, async () => {
        const valuesInput = this.interval.getValuesInput();
        await valuesInput.fill(intervals);
        await valuesInput.blur();
      });
    },
    /** Returns the auto option checkbox input; it is visually hidden, so assert its checked state rather than act on it */
    getAutoCheckbox: (): Locator =>
      this.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.autoEnabledCheckbox
      ),
    /** Returns the step count select (only rendered while the auto option is enabled) */
    getStepCountSelect: (): Locator =>
      this.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.stepCountIntervalSelect,
        { root: this.getByGrafanaSelector(this.selectors.components.Sidebar.container) }
      ),
    /** Selects the auto option's step count (the auto option must be enabled) */
    selectStepCount: async (stepCount: number) => {
      await test.step(`Select step count "${stepCount}"`, async () => {
        await this.interval.getStepCountSelect().click();
        await this.page
          .getByRole('listbox')
          .getByRole('option', { name: String(stepCount), exact: true })
          .click();
      });
    },
    /** Toggles the interval variable's auto option */
    toggleAuto: async () => {
      await test.step('Toggle auto option for interval variable', async () => {
        await this.getByGrafanaSelector(this.selectors.components.Sidebar.container)
          // there's a checkbox input in the DOM with a proper data-testid, but it's hidden (opacity 0) so Playwright cannot check it
          .getByText('Auto option')
          .click();
      });
    },
  };
}
