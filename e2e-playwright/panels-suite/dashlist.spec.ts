import { test, expect } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'a6801696-cc53-4196-b1f9-2403e3909185/panel-tests-dashlist-variables';

test.describe(
  'Panels test: DashList panel',
  {
    tag: '@panels',
  },
  () => {
    // this is to prevent the fix for https://github.com/grafana/grafana/issues/76800 from regressing
    test('should pass current variable values correctly when `Include current template variable values` is set', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      // check the initial value of the urls contain the variable value correctly
      const panel = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Include time range and variables enabled')
      );
      await expect(panel).toBeVisible();

      const links = panel.locator('a');
      const linkCount = await links.count();
      for (let i = 0; i < linkCount; i++) {
        const href = await links.nth(i).getAttribute('href');
        expect(href).toContain('var-server=A');
      }

      // update variable to b
      const serverVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('server'))
        .locator('..')
        .locator('input');
      await serverVariable.click();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B'))
        .click();

      // blur the dropdown
      await page.locator('body').click({ position: { x: 0, y: 0 } });

      // check the urls are updated with the new variable value
      await expect(panel).toBeVisible();
      const updatedLinks = panel.locator('a');
      const updatedLinkCount = await updatedLinks.count();
      for (let i = 0; i < updatedLinkCount; i++) {
        const href = await updatedLinks.nth(i).getAttribute('href');
        expect(href).toContain('var-server=B');
      }
    });
  }
);
