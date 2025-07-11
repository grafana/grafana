import { test, expect } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'OY8Ghjt7k/repeating-a-panel-vertically';

test.describe(
  'Repeating a panel vertically',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('should be able to repeat a panel vertically', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      let prevTop = Number.NEGATIVE_INFINITY;
      let prevLeft: number | null = null;
      const panelTitles = ['Panel Title 1', 'Panel Title 2', 'Panel Title 3'];

      for (const title of panelTitles) {
        const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title));
        await expect(panel).toBeVisible();

        const boundingBox = await panel.boundingBox();
        expect(boundingBox).not.toBeNull();

        if (boundingBox) {
          const { x: left, y: top } = boundingBox;
          expect(top).toBeGreaterThan(prevTop);
          if (prevLeft !== null) {
            expect(left).toBe(prevLeft);
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
      const verticalVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('vertical'))
        .locator('..')
        .locator('input');
      await verticalVariable.click();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('1'))
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('3'))
        .click();

      // blur the dropdown
      await page.locator('body').click();

      // Verify positioning of shown panels
      let prevTop = Number.NEGATIVE_INFINITY;
      let prevLeft: number | null = null;
      const panelsShown = ['Panel Title 1', 'Panel Title 3'];
      const panelsNotShown = ['Panel Title 2'];

      for (const title of panelsShown) {
        const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title));
        await expect(panel).toBeVisible();

        const boundingBox = await panel.boundingBox();
        expect(boundingBox).not.toBeNull();

        if (boundingBox) {
          const { x: left, y: top } = boundingBox;
          expect(top).toBeGreaterThan(prevTop);
          if (prevLeft !== null) {
            expect(left).toBe(prevLeft);
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
      const dashboardPage = await gotoDashboardPage({ uid: `${PAGE_UNDER_TEST}?var-vertical=1&var-vertical=3` });

      let prevTop = Number.NEGATIVE_INFINITY;
      let prevLeft: number | null = null;
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
          expect(top).toBeGreaterThan(prevTop);
          if (prevLeft !== null) {
            expect(left).toBe(prevLeft);
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
