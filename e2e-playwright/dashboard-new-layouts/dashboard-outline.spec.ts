import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Sidebar } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = 'edediimbjhdz4b/a-tall-dashboard';

test.describe(
  'Dashboard Outline',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can use dashboard outline', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');

      // Should be able to click Variables item in outline to see add variable button
      await sidebar.contentOutline.clickItem('Variables');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.addVariableButton)
      ).toBeVisible();

      await sidebar.toolbar.clickButton('Outline');

      // Clicking a panel should scroll that panel in view
      await expect(page.getByText('Dashboard panel 48')).not.toBeInViewport();

      await sidebar.contentOutline.clickItem('Panel #48');
      await expect(page.getByText('Dashboard panel 48')).toBeInViewport();
    });

    test('outline expanded state persists after closing and reopening the pane', async ({
      gotoDashboardPage,
      selectors,
      page,
      components,
    }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');

      const outlineTree = sidebar.contentOutline.getTree();
      const emptyIndicator = outlineTree.getByText('(empty)').first();

      await expect(emptyIndicator).not.toBeVisible();

      await sidebar.contentOutline.toggleNode('Variables');
      await expect(emptyIndicator).toBeVisible();

      await sidebar.toolbar.clickButton('Outline');
      await expect(outlineTree).not.toBeVisible();

      await sidebar.toolbar.clickButton('Outline');
      await expect(emptyIndicator).toBeVisible();
    });

    test('outline expanded state persists after discarding edit mode changes', async ({
      gotoDashboardPage,
      selectors,
      page,
      components,
    }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');

      const outlineTree = sidebar.contentOutline.getTree();

      await sidebar.contentOutline.toggleNode('Variables');
      await expect(outlineTree.getByText('(empty)').first()).toBeVisible();

      await controls.exitEditMode();

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');
      await expect(outlineTree.getByText('(empty)').first()).toBeVisible();
    });
  }
);
