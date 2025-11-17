import { Page } from 'playwright-core';

import { test, expect, E2ESelectorGroups } from '@grafana/plugin-e2e';

import { addDashboard } from '../utils/dashboard-helpers';
import { getResources } from '../utils/prometheus-helpers';

test.describe(
  'Prometheus variable query editor',
  {
    tag: ['@various'],
  },
  () => {
    const DATASOURCE_PREFIX = 'prometheusVariableDS';

    /**
     * Click dashboard settings and then the variables tab
     */
    async function navigateToVariables(page: Page, selectors: E2ESelectorGroups) {
      const editButton = page.getByTestId(selectors.components.NavToolbar.editDashboard.editButton);
      await expect(editButton).toBeVisible();
      await editButton.click();

      const settingsButton = page.getByTestId(selectors.components.NavToolbar.editDashboard.settingsButton);
      await expect(settingsButton).toBeVisible();
      await settingsButton.click();

      const variablesTab = page.getByTestId(selectors.components.Tab.title('Variables'));
      await variablesTab.click();
    }

    /**
     * Begin the process of adding a query type variable for a Prometheus data source
     */
    async function addPrometheusQueryVariable(
      page: Page,
      selectors: E2ESelectorGroups,
      datasourceName: string,
      variableName: string
    ) {
      const addVariableButton = page.getByTestId(selectors.pages.Dashboard.Settings.Variables.List.addVariableCTAV2);
      await addVariableButton.click();

      const nameInput = page.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2);
      await nameInput.clear();
      await nameInput.fill(variableName);

      const dataSourcePicker = page.getByTestId(selectors.components.DataSourcePicker.container);
      await expect(dataSourcePicker).toBeVisible();
      await dataSourcePicker.click();

      const dataSourceOption = page.getByText(datasourceName);
      await dataSourceOption.scrollIntoViewIfNeeded();
      await expect(dataSourceOption).toBeVisible();
      await dataSourceOption.click();

      await getResources(page);
    }

    /**
     * Create a Prometheus variable and navigate to the query editor to check that it is available to use.
     */
    async function variableFlowToQueryEditor(
      page: Page,
      selectors: E2ESelectorGroups,
      datasourceName: string,
      variableName: string,
      queryType: string
    ) {
      await addDashboard(page);
      await navigateToVariables(page, selectors);
      await addPrometheusQueryVariable(page, selectors, datasourceName, variableName);

      // Select query type
      const queryTypeSelect = page.getByTestId(
        selectors.components.DataSource.Prometheus.variableQueryEditor.queryType
      );
      await queryTypeSelect.click();
      await selectOption(page, queryType);

      // Apply the variable
      const applyButton = page.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton);
      await applyButton.click();

      // Close to return to dashboard
      const backToDashboardButton = page.getByTestId(
        selectors.components.NavToolbar.editDashboard.backToDashboardButton
      );
      await expect(backToDashboardButton).toBeVisible();
      await backToDashboardButton.click();

      // Add visualization
      const createNewPanelButton = page.getByTestId(selectors.pages.AddDashboard.itemButton('Create new panel button'));
      await expect(createNewPanelButton).toBeVisible();
      await createNewPanelButton.click();

      // Close the data source picker modal
      const closeButton = page.getByRole('button', { name: 'Close menu' });
      await closeButton.click({ force: true });

      // Select prom data source from the data source list
      const dataSourcePickerInput = page.getByTestId(selectors.components.DataSourcePicker.inputV2);
      await dataSourcePickerInput.click();
      await dataSourcePickerInput.fill(datasourceName);
      await page.keyboard.press('Enter');

      // Confirm the variable exists in the correct input
      switch (queryType) {
        case 'Label names':
          const labelSelect = page.getByTestId(selectors.components.QueryBuilder.labelSelect);
          await expect(labelSelect).toBeVisible();
          await labelSelect.click();
          await selectOption(page, variableName);
          break;
        case 'Label values':
          const valueSelect = page.getByTestId(selectors.components.QueryBuilder.valueSelect);
          await expect(valueSelect).toBeVisible();
          await valueSelect.click();
          await selectOption(page, variableName);
          break;
        case 'Metrics':
          const metricSelect = page.getByTestId(
            selectors.components.DataSource.Prometheus.queryEditor.builder.metricSelect
          );
          await expect(metricSelect).toBeVisible();
          await metricSelect.click();
          await selectOption(page, variableName);
          break;
        default:
          // do nothing
          break;
      }
    }

    test('should navigate to variable query editor', async ({ page, selectors }) => {
      await addDashboard(page);
      await navigateToVariables(page, selectors);
    });

    test('should select a query type for a Prometheus variable query', async ({
      createDataSource,
      page,
      selectors,
    }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      await createDataSource({ type: 'prometheus', name: DATASOURCE_NAME });
      await addDashboard(page);
      await navigateToVariables(page, selectors);
      await addPrometheusQueryVariable(page, selectors, DATASOURCE_NAME, 'labelsVariable');

      // Select query type
      const queryTypeSelect = page.getByTestId(
        selectors.components.DataSource.Prometheus.variableQueryEditor.queryType
      );
      await queryTypeSelect.click();
      await selectOption(page, 'Label names');
    });

    test('should create a label names variable that is selectable in the label select in query builder', async ({
      createDataSource,
      page,
      selectors,
    }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      await createDataSource({ type: 'prometheus', name: DATASOURCE_NAME });
      await variableFlowToQueryEditor(page, selectors, DATASOURCE_NAME, 'labelnames', 'Label names');
    });

    test('should create a label values variable that is selectable in the label values select in query builder', async ({
      createDataSource,
      page,
      selectors,
    }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      await createDataSource({ type: 'prometheus', name: DATASOURCE_NAME });
      await variableFlowToQueryEditor(page, selectors, DATASOURCE_NAME, 'labelvalues', 'Label values');
    });

    test('should create a metric names variable that is selectable in the metric select in query builder', async ({
      createDataSource,
      page,
      selectors,
    }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      await createDataSource({ type: 'prometheus', name: DATASOURCE_NAME });
      await variableFlowToQueryEditor(page, selectors, DATASOURCE_NAME, 'metrics', 'Metrics');
    });
  }
);

async function selectOption(page: Page, option: string) {
  const optionElement = page.getByRole('option', { name: option });
  await expect(optionElement).toBeVisible();
  await optionElement.click();
}
