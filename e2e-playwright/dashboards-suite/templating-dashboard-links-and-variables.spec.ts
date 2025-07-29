import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'yBCC3aKGk';

test.describe(
  'Templating dashboard links and variables',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Tests dashboard links and variables in links', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

      const verifyLinks = async (variableValue: string) => {
        const dashboardLinks = dashboardPage.getByGrafanaSelector(selectors.components.DashboardLinks.link);

        let linkCount = 0;
        await expect
          .poll(async () => {
            linkCount = await dashboardLinks.count();
            return linkCount;
          })
          .toBeGreaterThan(13);

        for (let i = 0; i < linkCount; i++) {
          const href = await dashboardLinks.nth(i).getAttribute('href');
          expect(href).toContain(variableValue);
        }
      };

      // Click on dashboard links dropdown
      const dashboardLinksDropdown = dashboardPage.getByGrafanaSelector(selectors.components.DashboardLinks.dropDown);
      await expect(dashboardLinksDropdown).toBeVisible();
      await dashboardLinksDropdown.click();

      // Verify links contain default variable value
      await verifyLinks('var-custom=$__all');

      // Close dropdown
      await page.locator('body').click({ position: { x: 0, y: 0 } });

      // Change variable value from $__all to p2
      const customVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('$__all'))
        .locator('input');
      await expect(customVariable).toBeVisible();
      await customVariable.click();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('p2'))
        .click();

      // Close dropdown
      await page.locator('body').click({ position: { x: 0, y: 0 } });

      // Open dashboard links dropdown again
      await expect(dashboardLinksDropdown).toBeVisible();
      await dashboardLinksDropdown.click();

      // Verify all links now contain the p2 value
      await verifyLinks('p2');
    });
  }
);
