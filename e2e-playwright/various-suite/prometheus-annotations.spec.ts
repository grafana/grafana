import { Page } from 'playwright-core';

import { test, expect, E2ESelectorGroups } from '@grafana/plugin-e2e';

import { addDashboard } from '../utils/dashboard-helpers';
import { getResources } from '../utils/prometheus-helpers';

test.describe(
  'Prometheus annotations',
  {
    tag: ['@various'],
  },
  () => {
    const DATASOURCE_NAME = 'aprometheusAnnotationDS';

    test('should navigate to variable query editor', async ({ page, selectors, createDataSourceConfigPage }) => {
      const annotationName = 'promAnnotation';

      await createDataSourceConfigPage({ type: 'prometheus', name: DATASOURCE_NAME });

      // Add a new dashboard
      await addDashboard(page);

      // Navigate to annotations
      await navigateToAnnotations(page, selectors);

      // Add Prometheus annotation
      await addPrometheusAnnotation(page, selectors, annotationName);

      // Open metrics browser
      const metricsBrowserButton = page.getByTestId(
        selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.openButton
      );
      await metricsBrowserButton.click();

      // Type in the metric selector
      const selectMetricInput = page.getByTestId(
        selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.selectMetric
      );
      await expect(selectMetricInput).toBeVisible();
      await selectMetricInput.fill('met');

      // Select metric1 from the list
      const metricList = page.getByTestId(
        selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.metricList
      );
      await expect(metricList).toBeVisible();
      const metric1Option = metricList.getByText('metric1');
      await metric1Option.click();

      // Use the query
      const useQueryButton = page.getByTestId(
        selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useQuery
      );
      await expect(useQueryButton).toBeVisible();
      await useQueryButton.click();

      // Verify query field contains metric1
      const queryField = page.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.code.queryField);
      await expect(queryField).toBeVisible();
      await expect(queryField).toContainText('metric1');

      // Check for other parts of the annotations
      // Min step
      const minStepInput = page.getByTestId(selectors.components.DataSource.Prometheus.annotations.minStep);
      await expect(minStepInput).toBeVisible();

      // Title
      const titleInput = page.getByTestId(selectors.components.DataSource.Prometheus.annotations.title);
      await titleInput.scrollIntoViewIfNeeded();
      await expect(titleInput).toBeVisible();

      // Tags
      const tagsInput = page.getByTestId(selectors.components.DataSource.Prometheus.annotations.tags);
      await tagsInput.scrollIntoViewIfNeeded();
      await expect(tagsInput).toBeVisible();

      // Text
      const textInput = page.getByTestId(selectors.components.DataSource.Prometheus.annotations.text);
      await textInput.scrollIntoViewIfNeeded();
      await expect(textInput).toBeVisible();

      // Series value as timestamp
      const seriesValueSwitch = page.getByTestId(
        selectors.components.DataSource.Prometheus.annotations.seriesValueAsTimestamp
      );
      await seriesValueSwitch.scrollIntoViewIfNeeded();
      await expect(seriesValueSwitch).toBeVisible();

      // Go back to dashboard
      const backButton = page.getByTestId(selectors.components.NavToolbar.editDashboard.backToDashboardButton);
      await expect(backButton).toBeVisible();
      await backButton.click();

      // Check that annotation exists
      await expect(page.getByText(annotationName)).toBeVisible();
    });

    /**
     * Click dashboard settings and then the annotations tab
     */
    async function navigateToAnnotations(page: Page, selectors: E2ESelectorGroups) {
      const editButton = page.getByTestId(selectors.components.NavToolbar.editDashboard.editButton);
      await expect(editButton).toBeVisible();
      await editButton.click();

      const settingsButton = page.getByTestId(selectors.components.NavToolbar.editDashboard.settingsButton);
      await expect(settingsButton).toBeVisible();
      await settingsButton.click();

      const annotationsTab = page.getByTestId(selectors.components.Tab.title('Annotations'));
      await annotationsTab.click();
    }

    async function addPrometheusAnnotation(page: Page, selectors: E2ESelectorGroups, annotationName: string) {
      const addAnnotationButton = page.getByTestId(
        selectors.pages.Dashboard.Settings.Annotations.List.addAnnotationCTAV2
      );
      await addAnnotationButton.click();

      await getResources(page);

      const nameInput = page.getByTestId(selectors.pages.Dashboard.Settings.Annotations.Settings.name);
      await nameInput.clear();
      await nameInput.fill(annotationName);

      const dataSourcePicker = page.getByTestId(selectors.components.DataSourcePicker.container);
      await expect(dataSourcePicker).toBeVisible();
      await dataSourcePicker.click();

      const dataSourceOption = page.getByText(DATASOURCE_NAME);
      await dataSourceOption.scrollIntoViewIfNeeded();
      await expect(dataSourceOption).toBeVisible();
      await dataSourceOption.click();
    }
  }
);
