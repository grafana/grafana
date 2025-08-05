import { test, expect } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'WVpf2jp7z/repeating-a-panel-horizontally';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Repeating a panel horizontally',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('should be able to repeat a panel horizontally', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      let prevLeft = Number.NEGATIVE_INFINITY;
      let prevTop: number | null = null;
      const panelTitles = ['Panel Title 1', 'Panel Title 2', 'Panel Title 3'];

      for (const title of panelTitles) {
        const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title));
        await expect(panel).toBeVisible();

        const boundingBox = await panel.boundingBox();
        expect(boundingBox).not.toBeNull();

        if (boundingBox) {
          const { x: left, y: top } = boundingBox;
          expect(left).toBeGreaterThan(prevLeft);
          if (prevTop !== null) {
            expect(top).toBe(prevTop);
          }

          prevLeft = left;
          prevTop = top;
        }
      }
    });

    test('responds to changes to the variables', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const panelTitles = ['Panel Title 1', 'Panel Title 2', 'Panel Title 3'];

      // Verify all panels are initially visible
      for (const title of panelTitles) {
        const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title));
        await expect(panel).toBeVisible();
      }

      // Change to only show panels 1 + 3
      const horizontalVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('horizontal'))
        .locator('..')
        .locator('input');
      await horizontalVariable.click();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('1'))
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('3'))
        .click();

      // blur the dropdown
      await page.locator('body').click();

      // Verify positioning of shown panels
      let prevLeft = Number.NEGATIVE_INFINITY;
      let prevTop: number | null = null;
      const panelsShown = ['Panel Title 1', 'Panel Title 3'];
      const panelsNotShown = ['Panel Title 2'];

      for (const title of panelsShown) {
        const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title));
        await expect(panel).toBeVisible();

        const boundingBox = await panel.boundingBox();
        expect(boundingBox).not.toBeNull();

        if (boundingBox) {
          const { x: left, y: top } = boundingBox;
          expect(left).toBeGreaterThan(prevLeft);
          if (prevTop !== null) {
            expect(top).toBe(prevTop);
          }

          prevLeft = left;
          prevTop = top;
        }
      }

      for (const title of panelsNotShown) {
        const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title));
        await expect(panel).toBeHidden();
      }
    });

    test('loads a dashboard based on the query params correctly', async ({ gotoDashboardPage, selectors }) => {
      // Have to manually add the queryParams to the url because they have the same name
      const dashboardPage = await gotoDashboardPage({ uid: `${PAGE_UNDER_TEST}?var-horizontal=1&var-horizontal=3` });

      let prevLeft = Number.NEGATIVE_INFINITY;
      let prevTop: number | null = null;
      const panelsShown = ['Panel Title 1', 'Panel Title 3'];
      const panelsNotShown = ['Panel Title 2'];

      // Check correct panels are displayed with proper positioning
      for (const title of panelsShown) {
        const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title));
        await expect(panel).toBeVisible();

        const boundingBox = await panel.boundingBox();
        expect(boundingBox).not.toBeNull();

        if (boundingBox) {
          const { x: left, y: top } = boundingBox;
          expect(left).toBeGreaterThan(prevLeft);
          if (prevTop !== null) {
            expect(top).toBe(prevTop);
          }

          prevLeft = left;
          prevTop = top;
        }
      }

      for (const title of panelsNotShown) {
        const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title));
        await expect(panel).toBeHidden();
      }
    });
  }
);
