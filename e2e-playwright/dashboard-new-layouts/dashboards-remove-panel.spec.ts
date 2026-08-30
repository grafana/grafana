import { test, expect } from './fixtures';

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
    test('can remove a panel', async ({ gotoDashboardPage, selectors, page, controls, sidebar, panels }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await controls.enterEditMode();

      const panelTitle = /^Panel #1$/;
      await panels.selectByTitle(panelTitle);

      await sidebar.deleteSelection();

      await expect(page.getByRole('dialog', { name: 'Delete panel?' })).toBeVisible();
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();

      await expect(panels.getHeader(panelTitle)).toBeHidden();
    });

    test('can remove several panels at once', async ({
      gotoDashboardPage,
      selectors,
      page,
      controls,
      sidebar,
      panels,
    }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await controls.enterEditMode();

      const panelTitles = [/^Panel #1$/, /^Panel #2$/, /^Panel #3$/];
      await panels.selectByTitle(panelTitles);
      await sidebar.deleteSelection();

      await expect(page.getByRole('dialog', { name: 'Multiple panels' })).toBeVisible();
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();

      for (const panelTitle of panelTitles) {
        await expect(panels.getHeader(panelTitle)).toBeHidden();
      }
    });
  }
);
