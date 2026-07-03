import { type Page } from 'playwright-core';

import { test, expect, type Components, type E2ESelectorGroups } from '@grafana/plugin-e2e';

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

      // Open dashboard options in the sidebar
      const optionsButton = page.getByTestId(selectors.pages.Dashboard.Sidebar.optionsButton);
      await expect(optionsButton).toBeVisible();
      await optionsButton.click();

      // Click "View all settings" to open the full settings page
      const viewAllSettingsButton = page
        .getByTestId(selectors.components.Sidebar.container)
        .getByRole('button', { name: 'View all settings' });
      await expect(viewAllSettingsButton).toBeVisible();
      await viewAllSettingsButton.click();

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
      variableName: string,
      components: Components
    ) {
      const addVariableButton = page.getByTestId(selectors.pages.Dashboard.Settings.Variables.List.addVariableCTAV2);
      await addVariableButton.click();

      const nameInput = page.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2);
      await nameInput.clear();
      await nameInput.fill(variableName);

      await components.dataSourcePicker.set(datasourceName);

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
      queryType: string,
      components: Components
    ) {
      await addDashboard(page);
      await navigateToVariables(page, selectors);
      await addPrometheusQueryVariable(page, selectors, datasourceName, variableName, components);

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
      await page.getByTestId(selectors.pages.Dashboard.Sidebar.addButton).click(); // Open the "Add" pane in the sidebar
      await page.getByTestId(selectors.components.Sidebar.newPanelButton).click(); // Click the "Add new panel" button
      await page
        .getByTestId(selectors.components.Sidebar.container)
        .getByRole('button', { name: 'Edit visualization' })
        .click();

      // Select prom data source from the data source list
      await components.dataSourcePicker.set(datasourceName);

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
      components,
    }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      await createDataSource({ type: 'prometheus', name: DATASOURCE_NAME });
      await addDashboard(page);
      await navigateToVariables(page, selectors);
      await addPrometheusQueryVariable(page, selectors, DATASOURCE_NAME, 'labelsVariable', components);

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
      components,
    }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      await createDataSource({ type: 'prometheus', name: DATASOURCE_NAME });
      await variableFlowToQueryEditor(page, selectors, DATASOURCE_NAME, 'labelnames', 'Label names', components);
    });

    test('should create a label values variable that is selectable in the label values select in query builder', async ({
      createDataSource,
      page,
      selectors,
      components,
    }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      await createDataSource({ type: 'prometheus', name: DATASOURCE_NAME });
      await variableFlowToQueryEditor(page, selectors, DATASOURCE_NAME, 'labelvalues', 'Label values', components);
    });

    test('should create a metric names variable that is selectable in the metric select in query builder', async ({
      createDataSource,
      page,
      selectors,
      components,
    }) => {
      const DATASOURCE_NAME = `${DATASOURCE_PREFIX}_${Date.now()}`;
      await createDataSource({ type: 'prometheus', name: DATASOURCE_NAME });
      await variableFlowToQueryEditor(page, selectors, DATASOURCE_NAME, 'metrics', 'Metrics', components);
    });
  }
);

async function selectOption(page: Page, option: string) {
  const optionElement = page.getByRole('option', { name: option });
  await expect(optionElement).toBeVisible();
  await optionElement.click();
}
