import { Page } from 'playwright-core';

import { test, expect, E2ESelectorGroups, DashboardPage } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = 'AejrN1AMz';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'TextBox - load options scenarios',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('default options should be correct', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      await validateTextboxAndMarkup(page, dashboardPage, selectors, 'default value');
    });

    test('loading variable from url should be correct', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({
          'var-text': 'not default value',
        }),
      });

      await validateTextboxAndMarkup(page, dashboardPage, selectors, 'not default value');
    });
  }
);

// Helper function to validate textbox and markup
async function validateTextboxAndMarkup(
  page: Page,
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  value: string
) {
  const submenuItem = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem);
  await expect(submenuItem).toBeVisible();

  await expect(
    dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('text'))
  ).toBeVisible();

  const textInput = submenuItem.locator('input');
  await expect(textInput).toBeVisible();
  await expect(textInput).toHaveValue(value);

  const textPanel = page.locator(selectors.components.Panels.Visualization.Text.container(''));
  await expect(textPanel).toBeVisible();

  const headerElement = textPanel.locator('h1');
  await expect(headerElement).toBeVisible();
  await expect(headerElement).toHaveText(`variable: ${value}`);
}
