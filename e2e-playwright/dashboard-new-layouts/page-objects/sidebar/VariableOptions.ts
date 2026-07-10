import { test } from '@playwright/test';

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
    selectDatasourceType: async (dsType: string) => {
      await test.step(`Select variable datasource type "${dsType}"`, async () => {
        await this.dashboardPage
          .getByGrafanaSelector(
            this.selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect
          )
          .click();
        await this.page.getByRole('option', { name: dsType, exact: true }).click();
      });
    },
    setDatasourceNameFilter: async (filter: string) => {
      await test.step(`Set data source name filter "${filter}"`, async () => {
        await this.dashboardPage
          .getByGrafanaSelector(this.selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.nameFilter)
          .fill(filter);
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
}
