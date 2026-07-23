import { type Locator, test } from '@playwright/test';

import { PageObject } from '../PageObject';

// The edit pane shown after adding or selecting a variable — variable type,
// name/label inputs, plus type-specific options (e.g. datasource variables)
export class VariableOptions extends PageObject {
  async selectVariableType(type: string) {
    await test.step(`Select variable type "${type}"`, async () => {
      await this.dashboardPage
        .getByGrafanaSelector(this.selectors.components.PanelEditor.ElementEditPane.variableType(type))
        .click();
    });
  }

  async setName(name: string) {
    await test.step(`Set variable name to "${name}"`, async () => {
      const input = this.dashboardPage.getByGrafanaSelector(
        this.selectors.components.PanelEditor.ElementEditPane.variableNameInput
      );
      await input.click();
      await input.fill(name);
      await input.blur();
    });
  }

  async setLabel(label: string) {
    await test.step(`Set variable label to "${label}"`, async () => {
      const input = this.dashboardPage.getByGrafanaSelector(
        this.selectors.components.PanelEditor.ElementEditPane.variableLabelInput
      );
      await input.click();
      await input.fill(label);
      await input.blur();
    });
  }

  readonly datasource = {
    selectType: async (dsType: string) => {
      await test.step(`Select variable datasource type "${dsType}"`, async () => {
        await this.dashboardPage
          .getByGrafanaSelector(
            this.selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect
          )
          .click();
        await this.page.getByRole('option', { name: dsType, exact: true }).click();
      });
    },
    setNameFilter: async (filter: string) => {
      await test.step(`Set data source name filter "${filter}"`, async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.nameFilter)
          .fill(filter);
      });
    },
  };

  readonly custom = {
    openEditor: async () => {
      await test.step('Open custom variable editor', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.optionsOpenButton)
          .click();
      });
    },
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
    setValues: async (valuesInSelectedFormat: string) => {
      await test.step('Fill custom variable options', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput)
          .fill(valuesInSelectedFormat);
      });
    },
    getPreviewOfValues: (): Locator =>
      this.dashboardPage.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
      ),
    getPreviewTable: (): Locator =>
      // shown instead of the plain values preview when options carry properties beyond value/text
      this.dashboardPage.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.previewTable
      ),
    clickApplyButton: async () => {
      await test.step('Apply variable changes', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.applyButton)
          .click();
      });
    },
  };

  readonly groupby = {
    selectDatasource: async (dataSource: string) => {
      await test.step(`Select group by datasource "${dataSource}"`, async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.dataSourceSelect)
          .click();

        await this.page.keyboard.type(dataSource);
        await this.page.getByRole('button', { name: dataSource }).click();
      });
    },
  };

  readonly adhoc = {
    selectDatasource: async (dataSource: string) => {
      await test.step(`Select ad hoc datasource "${dataSource}"`, async () => {
        await this.dashboardPage
          .getByGrafanaSelector(
            this.selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.datasourceSelect
          )
          .click();

        await this.page.keyboard.type(dataSource);
        await this.page.getByRole('button', { name: dataSource }).click();

        await this.page
          .getByRole('alert', { name: /this data source does not support filters/ })
          .waitFor({ state: 'detached' });
      });
    },
  };

  readonly query = {
    openEditor: async () => {
      await test.step('Open query variable editor', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(
            this.selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsOpenButton
          )
          .click();
      });
    },
    selectDatasource: async (dataSource: string) => {
      await test.step(`Select query datasource "${dataSource}"`, async () => {
        await this.components.dataSourcePicker.set(dataSource);
      });
    },
    setQuery: async (query: string) => {
      await test.step(`Set variable query to "${query}"`, async () => {
        await this.dashboardPage
          .getByGrafanaSelector(
            this.selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput
          )
          .fill(query);
      });
    },
    runQuery: async () => {
      await test.step('Run query', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton)
          .click();
      });
    },
    getPreviewOfValues: (): Locator =>
      this.dashboardPage.getByGrafanaSelector(
        this.selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
      ),
    clickApplyButton: async () => {
      await test.step('Apply variable changes', async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.applyButton)
          .click();
      });
    },
  };
}
