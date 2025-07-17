import { Page } from 'playwright-core';

import { test, expect, E2ESelectorGroups, DashboardPage } from '@grafana/plugin-e2e';

import testV2Dashboard from '../dashboards/TestV2Dashboard.json';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

test.describe(
  'Dashboard Panel Layouts',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can switch to auto grid layout', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Switch to auto grid');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.OptionsGroup.toggle('grid-layout-category'))
        .click();

      await page.getByLabel('Auto grid').click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await checkAutoGridLayoutInputs(dashboardPage, selectors);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await checkAutoGridLayoutInputs(dashboardPage, selectors);
    });

    test('can change min column width in auto grid layout', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Set min column width');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.OptionsGroup.toggle('grid-layout-category'))
        .click();

      await page.getByLabel('Auto grid').click();

      // Get initial positions - standard width should have panels on different rows
      const firstPanelTop = await getPanelTop(dashboardPage, selectors);
      const lastPanel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel')).last();
      const lastPanelBox = await lastPanel.boundingBox();
      const lastPanelTop = lastPanelBox?.y || 0;

      // Verify standard layout has panels on different rows
      expect(lastPanelTop).toBeGreaterThan(firstPanelTop);

      // Change to narrow min column width
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth)
        .click();
      await page.getByRole('option', { name: 'Narrow' }).click();

      // Verify narrow layout has all panels on same row
      const firstPanelTopNarrow = await getPanelTop(dashboardPage, selectors);
      const lastPanelBoxNarrow = await lastPanel.boundingBox();
      const lastPanelTopNarrow = lastPanelBoxNarrow?.y || 0;

      expect(lastPanelTopNarrow).toBe(firstPanelTopNarrow);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth
        )
      ).toHaveValue('Narrow');

      const firstPanelTopReload = await getPanelTop(dashboardPage, selectors);
      const lastPanelBoxReload = await lastPanel.boundingBox();
      const lastPanelTopReload = lastPanelBoxReload?.y || 0;

      expect(lastPanelTopReload).toBe(firstPanelTopReload);
    });

    test('can change to custom min column width in auto grid layout', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Set custom min column width');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.OptionsGroup.toggle('grid-layout-category'))
        .click();

      await page.getByLabel('Auto grid').click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth)
        .click();
      await page.getByRole('option', { name: 'Custom' }).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customMinColumnWidth)
        .fill('900');
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customMinColumnWidth)
        .blur();

      // Changing to 900 custom width should have each panel span the whole row (stacked vertically)
      await verifyPanelsStackedVertically(dashboardPage, selectors);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      await verifyPanelsStackedVertically(dashboardPage, selectors);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customMinColumnWidth
        )
      ).toHaveValue('900');

      await verifyPanelsStackedVertically(dashboardPage, selectors);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomMinColumnWidth)
        .click();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth
        )
      ).toHaveValue('Standard');
    });

    test('can change max columns in auto grid layout', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Set max columns');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.OptionsGroup.toggle('grid-layout-category'))
        .click();

      await page.getByLabel('Auto grid').click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.maxColumns)
        .click();
      await page.getByRole('option', { name: '1', exact: true }).click();

      // Changing to 1 max column should have each panel span the whole row (stacked vertically)
      await verifyPanelsStackedVertically(dashboardPage, selectors);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      await verifyPanelsStackedVertically(dashboardPage, selectors);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.maxColumns)
      ).toHaveValue('1');

      await verifyPanelsStackedVertically(dashboardPage, selectors);
    });

    test('can change row height in auto grid layout', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Set row height');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.OptionsGroup.toggle('grid-layout-category'))
        .click();

      await page.getByLabel('Auto grid').click();

      const regularRowHeight = await getPanelHeight(dashboardPage, selectors);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight)
        .click();
      await page.getByRole('option', { name: 'Short' }).click();

      const shortHeight = await getPanelHeight(dashboardPage, selectors);
      expect(shortHeight).toBeLessThan(regularRowHeight);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight)
        .click();
      await page.getByRole('option', { name: 'Tall' }).click();

      const tallHeight = await getPanelHeight(dashboardPage, selectors);
      expect(tallHeight).toBeGreaterThan(regularRowHeight);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      const tallHeightAfterReload = await getPanelHeight(dashboardPage, selectors);
      expect(tallHeightAfterReload).toBeGreaterThan(regularRowHeight);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight)
      ).toHaveValue('Tall');

      const tallHeightAfterEdit = await getPanelHeight(dashboardPage, selectors);
      expect(tallHeightAfterEdit).toBeGreaterThan(regularRowHeight);
    });

    test('can change to custom row height in auto grid layout', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Set custom row height');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.OptionsGroup.toggle('grid-layout-category'))
        .click();

      await page.getByLabel('Auto grid').click();

      const regularRowHeight = await getPanelHeight(dashboardPage, selectors);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight)
        .click();
      await page.getByRole('option', { name: 'Custom' }).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight)
        .fill('800');
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight)
        .blur();

      const customHeight = await getPanelHeight(dashboardPage, selectors);
      expect(customHeight).toBeCloseTo(800, 5); // Allow some tolerance for rendering differences
      expect(customHeight).toBeGreaterThan(regularRowHeight);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      const customHeightAfterReload = await getPanelHeight(dashboardPage, selectors);
      expect(customHeightAfterReload).toBeCloseTo(800, 5);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight
        )
      ).toHaveValue('800');

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomRowHeight)
        .click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight)
      ).toHaveValue('Standard');
    });

    test('can change fill screen in auto grid layout', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Set fill screen');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toHaveCount(3);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.OptionsGroup.toggle('grid-layout-category'))
        .click();

      await page.getByLabel('Auto grid').click();

      // Set narrow column width first to ensure panels fit horizontally
      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth)
        .click();
      await page.getByRole('option', { name: 'Narrow' }).click();

      const initialHeight = await getPanelHeight(dashboardPage, selectors);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen)
        .click({ force: true });

      const fillScreenHeight = await getPanelHeight(dashboardPage, selectors);
      expect(fillScreenHeight).toBeGreaterThan(initialHeight);

      await saveDashboard(dashboardPage, selectors);
      await page.reload();

      const fillScreenHeightAfterReload = await getPanelHeight(dashboardPage, selectors);
      expect(fillScreenHeightAfterReload).toBeGreaterThan(initialHeight);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen)
      ).toBeChecked();

      const fillScreenHeightAfterEdit = await getPanelHeight(dashboardPage, selectors);
      expect(fillScreenHeightAfterEdit).toBeGreaterThan(initialHeight);
    });
  }
);

// Helper functions
async function importTestDashboard(page: Page, selectors: E2ESelectorGroups, title: string) {
  await page.goto(selectors.pages.ImportDashboard.url);
  await page.getByTestId(selectors.components.DashboardImportPage.textarea).fill(JSON.stringify(testV2Dashboard));
  await page.getByTestId(selectors.components.DashboardImportPage.submit).click();
  await page.getByTestId(selectors.components.ImportDashboardForm.name).fill(title);
  await page.getByTestId(selectors.components.ImportDashboardForm.submit).click();
}

async function saveDashboard(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton).click();
  await dashboardPage.getByGrafanaSelector(selectors.components.Drawer.DashboardSaveDrawer.saveButton).click();
}

async function checkAutoGridLayoutInputs(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  await expect(
    dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth)
  ).toBeVisible();
  await expect(
    dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.maxColumns)
  ).toBeVisible();
  await expect(
    dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight)
  ).toBeVisible();
  await expect(
    dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen)
  ).toBeVisible();
}

async function verifyPanelsStackedVertically(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  const panels = await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel')).all();
  let previousTop = 0;

  for (const panel of panels) {
    const boundingBox = await panel.boundingBox();
    if (boundingBox) {
      if (previousTop === 0) {
        previousTop = boundingBox.y;
      } else {
        expect(boundingBox.y).toBeGreaterThan(previousTop);
        previousTop = boundingBox.y;
      }
    }
  }
}

async function getPanelHeight(dashboardPage: DashboardPage, selectors: E2ESelectorGroups): Promise<number> {
  const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel')).first();
  const boundingBox = await panel.boundingBox();
  return boundingBox?.height || 0;
}

async function getPanelTop(dashboardPage: DashboardPage, selectors: E2ESelectorGroups): Promise<number> {
  const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel')).first();
  const boundingBox = await panel.boundingBox();
  return boundingBox?.y || 0;
}
