import { test, expect } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'dtpl2Ctnk/repeating-an-empty-row';

test.describe(
  'Repeating empty rows',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('should be able to repeat empty rows vertically', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      let prevTop = Number.NEGATIVE_INFINITY;
      const rowTitles = ['Row title 1', 'Row title 2', 'Row title 3'];

      for (const title of rowTitles) {
        const row = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(title));
        await expect(row).toBeVisible();

        const boundingBox = await row.boundingBox();
        expect(boundingBox).not.toBeNull();

        if (boundingBox) {
          const { y: top } = boundingBox;
          expect(top).toBeGreaterThan(prevTop);
          prevTop = top;
        }
      }
    });

    test('responds to changes to the variables', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const rowTitles = ['Row title 1', 'Row title 2', 'Row title 3'];

      // Verify all rows are initially visible
      for (const title of rowTitles) {
        const row = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(title));
        await expect(row).toBeVisible();
      }

      // Change to only show rows 1 + 3
      const rowVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('row'))
        .locator('..')
        .locator('input');
      await rowVariable.click();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('1'))
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('3'))
        .click();

      // blur the dropdown
      await page.locator('body').click();

      // Verify positioning of shown rows
      let prevTop = Number.NEGATIVE_INFINITY;
      const rowsShown = ['Row title 1', 'Row title 3'];
      const rowsNotShown = ['Row title 2'];

      for (const title of rowsShown) {
        const row = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(title));
        await expect(row).toBeVisible();

        const boundingBox = await row.boundingBox();
        expect(boundingBox).not.toBeNull();

        if (boundingBox) {
          const { y: top } = boundingBox;
          expect(top).toBeGreaterThan(prevTop);
          prevTop = top;
        }
      }

      for (const title of rowsNotShown) {
        const row = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(title));
        await expect(row).toBeHidden();
      }
    });

    test('loads a dashboard based on the query params correctly', async ({ gotoDashboardPage, selectors }) => {
      // Have to manually add the queryParams to the url because they have the same name
      const dashboardPage = await gotoDashboardPage({ uid: `${PAGE_UNDER_TEST}?var-row=1&var-row=3` });

      let prevTop = Number.NEGATIVE_INFINITY;
      const rowsShown = ['Row title 1', 'Row title 3'];
      const rowsNotShown = ['Row title 2'];

      // Check correct rows are displayed with proper positioning
      for (const title of rowsShown) {
        const row = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(title));
        await expect(row).toBeVisible();

        const boundingBox = await row.boundingBox();
        expect(boundingBox).not.toBeNull();

        if (boundingBox) {
          const { y: top } = boundingBox;
          expect(top).toBeGreaterThan(prevTop);
          prevTop = top;
        }
      }

      for (const title of rowsNotShown) {
        const row = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.title(title));
        await expect(row).toBeHidden();
      }
    });
  }
);
