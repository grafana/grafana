import { Locator, Page } from 'playwright-core';

import { test, expect, DashboardPage, E2ESelectorGroups } from '@grafana/plugin-e2e';

test.describe(
  'Panels test: Queries',
  {
    tag: ['@panels'],
  },
  () => {
    test('Tests various Panel edit queries scenarios', async ({ selectors, gotoDashboardPage, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: '5SdHCadmz',
        queryParams: new URLSearchParams({ editPanel: '3' }),
      });

      // New panel editor opens when navigating from Panel menu
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();

      // Queries tab is rendered and open by default
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.DataPane.content)).toBeVisible();

      // We expect row with refId A to exist and be visible
      const initialRows = dashboardPage.getByGrafanaSelector(selectors.components.QueryEditorRows.rows);
      await expect(initialRows).toHaveCount(1);

      // Add query button should be visible and clicking on it should create a new row
      await dashboardPage.getByGrafanaSelector(selectors.components.QueryTab.addQuery).click();

      // We expect row with refId A and B to exist and be visible
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.QueryEditorRows.rows)).toHaveCount(2);

      // Remove refId A
      await dashboardPage
        .getByGrafanaSelector(selectors.components.QueryEditorRow.actionButton('Remove query'))
        .first()
        .click();

      // We expect row with refId B to exist and be visible
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.QueryEditorRows.rows)).toHaveCount(1);

      // Duplicate refId B
      await dashboardPage
        .getByGrafanaSelector(selectors.components.QueryEditorRow.actionButton('Duplicate query'))
        .first()
        .click();

      // We expect row with refId B and A to exist and be visible
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.QueryEditorRows.rows)).toHaveCount(2);

      // Change to CSV Metric Values scenario for A
      const scenarioSelect = dashboardPage
        .getByGrafanaSelector(selectors.components.DataSource.TestData.QueryTab.scenarioSelectContainer)
        .first();
      await scenarioSelect.locator('input[id*="test-data-scenario-select-"]').first().click();
      await page.getByText('CSV Metric Values').first().click();

      // Verify both queries are present in inspector
      await expectInspectorResultAndClose(page, dashboardPage, selectors, async (keys) => {
        const keyTexts = await keys.allTextContents();
        const length = keyTexts.length;
        const resultIds = new Set<string>([
          keyTexts[length - 2], // last 2
          keyTexts[length - 1], // last 2
        ]);

        expect(resultIds.has('A:')).toBe(true);
        expect(resultIds.has('B:')).toBe(true);
      });

      // Hide response for row with refId A
      await dashboardPage
        .getByGrafanaSelector(selectors.components.QueryEditorRow.actionButton('Hide response'))
        .nth(1)
        .click();

      await expectInspectorResultAndClose(page, dashboardPage, selectors, async (keys) => {
        const keyTexts = await keys.allTextContents();
        const length = keyTexts.length;
        expect(keyTexts[length - 1]).toBe('B:');
      });

      // Show response for row with refId A
      await dashboardPage
        .getByGrafanaSelector(selectors.components.QueryEditorRow.actionButton('Hide response'))
        .nth(1)
        .click();

      await expectInspectorResultAndClose(page, dashboardPage, selectors, async (keys) => {
        const keyTexts = await keys.allTextContents();
        const length = keyTexts.length;
        const resultIds = new Set<string>([
          keyTexts[length - 2], // last 2
          keyTexts[length - 1], // last 2
        ]);

        expect(resultIds.has('A:')).toBe(true);
        expect(resultIds.has('B:')).toBe(true);
      });
    });
  }
);

const expectInspectorResultAndClose = async (
  page: Page,
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  expectCallback: (keys: Locator) => Promise<void>
) => {
  await dashboardPage.getByGrafanaSelector(selectors.components.QueryTab.queryInspectorButton).click();
  await dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Query.refreshButton).click();

  const keys = page.locator(selectors.components.PanelInspector.Query.jsonObjectKeys(''));
  await expect(keys.first()).toBeVisible();
  await expectCallback(keys);

  await dashboardPage.getByGrafanaSelector(selectors.components.Drawer.General.close).click();
};
