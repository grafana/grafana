import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Panel, Sidebar } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = 'edediimbjhdz4b/a-tall-dashboard';

test.use({
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Dashboard panels',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can remove a panel', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      const controls = new Controls({ page, dashboardPage, selectors, components });
      const panel = new Panel({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();

      const panelTitle = /^Panel #1$/;
      await panel.selectByTitle(panelTitle);

      await sidebar.clickDeleteButton();

      await expect(page.getByRole('dialog', { name: 'Delete panel?' })).toBeVisible();
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();

      await expect(panel.getHeaderByTitle(panelTitle)).toBeHidden();
    });

    test('can remove several panels at once', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      const controls = new Controls({ page, dashboardPage, selectors, components });
      const panel = new Panel({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();

      const panelTitles = [/^Panel #1$/, /^Panel #2$/, /^Panel #3$/];
      await panel.selectByTitle(panelTitles);
      await sidebar.clickDeleteButton();

      await expect(page.getByRole('dialog', { name: 'Multiple panels' })).toBeVisible();
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();

      for (const panelTitle of panelTitles) {
        await expect(panel.getHeaderByTitle(panelTitle)).toBeHidden();
      }
    });
  }
);
