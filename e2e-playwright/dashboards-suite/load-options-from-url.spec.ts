import { test, expect } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = '-Y-tnEDWk/templating-nested-template-variables';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Variables - Load options from Url',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('default options should be correct', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      // Test first variable (A)
      const firstVariableInput = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A'))
        .locator('input');
      await expect(firstVariableInput).toBeVisible();
      await firstVariableInput.click();

      // Check dropdown has 10 options
      const firstDropdownOptions = dashboardPage.getByGrafanaSelector(selectors.components.Select.option).locator('..');
      await expect(firstDropdownOptions).toHaveCount(10);

      // Check toggle shows 'Selected (1)'
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Select.toggleAllOptions)).toHaveText(
        'Selected (1)'
      );

      // Check specific options are visible
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C'))
      ).toBeVisible();

      // Close dropdown by clicking outside
      await page.locator('body').click({ position: { x: 0, y: 0 } });

      // Test second variable (AA)
      const secondVariableInput = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AA'))
        .locator('input');

      await expect(secondVariableInput).toBeVisible();
      await secondVariableInput.click();

      // Check dropdown has 10 options
      const secondDropdownOptions = dashboardPage
        .getByGrafanaSelector(selectors.components.Select.option)
        .locator('..');
      await expect(secondDropdownOptions).toHaveCount(10);

      // Check toggle shows 'Selected (1)'
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Select.toggleAllOptions)).toHaveText(
        'Selected (1)'
      );

      // Check specific options are visible
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AA'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AB'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AC'))
      ).toBeVisible();

      // Close dropdown by clicking outside
      await page.locator('body').click({ position: { x: 0, y: 0 } });

      // Test third variable ($__all)
      const thirdVariableInput = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('$__all'))
        .locator('input');

      await expect(thirdVariableInput).toBeVisible();
      await thirdVariableInput.click();

      // Check dropdown has 10 options
      const thirdDropdownOptions = dashboardPage.getByGrafanaSelector(selectors.components.Select.option).locator('..');
      await expect(thirdDropdownOptions).toHaveCount(10);

      // Check toggle shows 'Selected (1)'
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Select.toggleAllOptions)).toHaveText(
        'Selected (1)'
      );

      // Check specific options are visible
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AAA'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AAB'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AAC'))
      ).toBeVisible();
    });

    test('options set in url should load correct options', async ({
      page,
      gotoDashboardPage,
      dashboardPage,
      selectors,
    }) => {
      await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({
          orgId: '1',
          'var-datacenter': 'B',
          'var-server': 'BB',
          'var-pod': 'BBB',
        }),
      });

      // Test first variable (B) - should be selected from URL
      const firstVariableInput = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B'))
        .locator('input');

      await expect(firstVariableInput).toBeVisible();
      await firstVariableInput.click();

      // Check dropdown has 10 options
      const firstDropdownOptions = dashboardPage.getByGrafanaSelector(selectors.components.Select.option).locator('..');
      await expect(firstDropdownOptions).toHaveCount(10);

      // Check toggle shows 'Selected (1)'
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Select.toggleAllOptions)).toHaveText(
        'Selected (1)'
      );

      // Check specific options are visible
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C'))
      ).toBeVisible();

      // Close dropdown by clicking outside
      await page.locator('body').click({ position: { x: 0, y: 0 } });

      // Test second variable (BB) - should be selected from URL
      const secondVariableInput = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BB'))
        .locator('input');

      await expect(secondVariableInput).toBeVisible();
      await secondVariableInput.click();

      // Check dropdown has 10 options
      const secondDropdownOptions = dashboardPage
        .getByGrafanaSelector(selectors.components.Select.option)
        .locator('..');
      await expect(secondDropdownOptions).toHaveCount(10);

      // Check toggle shows 'Selected (1)'
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Select.toggleAllOptions)).toHaveText(
        'Selected (1)'
      );

      // Check specific options are visible
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BA'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BB'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BC'))
      ).toBeVisible();

      // Close dropdown by clicking outside
      await page.locator('body').click({ position: { x: 0, y: 0 } });

      // Test third variable (BBB) - should be selected from URL
      const thirdVariableInput = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BBB'))
        .locator('input');

      await expect(thirdVariableInput).toBeVisible();
      await thirdVariableInput.click();

      // Check dropdown has 10 options
      const thirdDropdownOptions = dashboardPage.getByGrafanaSelector(selectors.components.Select.option).locator('..');
      await expect(thirdDropdownOptions).toHaveCount(10);

      // Check toggle shows 'Selected (1)'
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Select.toggleAllOptions)).toHaveText(
        'Selected (1)'
      );

      // Check specific options are visible
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBA'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBB'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BBC'))
      ).toBeVisible();
    });

    test('options set in url that do not exist should load correct options', async ({
      page,
      gotoDashboardPage,
      dashboardPage,
      selectors,
    }) => {
      // Handle uncaught exceptions that are expected
      page.on('pageerror', (error) => {
        if (error.message.includes("Couldn't find any field of type string in the results.")) {
          // This error is expected and should not fail the test
          return;
        }
        throw error;
      });

      await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({
          orgId: '1',
          'var-datacenter': 'X',
        }),
      });

      // Test first variable (X) - invalid value from URL
      const firstVariableInput = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('X'))
        .locator('input');

      await expect(firstVariableInput).toBeVisible();
      await firstVariableInput.click();

      // Check dropdown has 10 options
      const firstDropdownOptions = dashboardPage.getByGrafanaSelector(selectors.components.Select.option).locator('..');
      await expect(firstDropdownOptions).toHaveCount(10);

      // Check toggle shows 'Selected (1)'
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Select.toggleAllOptions)).toHaveText(
        'Selected (1)'
      );

      // Check specific options are visible (should fall back to default options)
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('C'))
      ).toBeVisible();

      // Close dropdown by clicking outside
      await page.locator('body').click();

      // Check that second variable shows $__all (should be 2 instances)
      const allVariables = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('$__all')
      );

      await expect(allVariables).toHaveCount(2);
      await expect(allVariables.first()).toBeVisible();
      await expect(allVariables.last()).toBeVisible();
    });
  }
);
