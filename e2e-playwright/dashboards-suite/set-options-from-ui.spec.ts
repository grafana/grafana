import { test, expect } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = '-Y-tnEDWk/templating-nested-template-variables';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Variables - Set options from ui',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('clicking a value that is not part of dependents options should change these to All', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({
          orgId: '1',
          'var-datacenter': 'A',
          'var-server': 'AA',
          'var-pod': 'AAA',
        }),
      });

      const datacenterVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A'))
        .locator('..')
        .locator('input');
      await expect(datacenterVariable).toBeVisible();
      await datacenterVariable.click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A'))
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B'))
        .click();

      await page.locator('body').click({ position: { x: 0, y: 0 } });

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B')
        )
      ).toBeVisible();

      const serverVariableAllOptions = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('$__all')
      );
      await expect(serverVariableAllOptions).toHaveCount(2);

      const firstServerDropdown = serverVariableAllOptions.nth(0);
      await expect(firstServerDropdown).toBeVisible();
      await firstServerDropdown.locator('input').click();

      const selectOptions = dashboardPage.getByGrafanaSelector(selectors.components.Select.option).locator('..');
      await expect(selectOptions).toHaveCount(10);

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Select.toggleAllOptions)).toHaveText(
        'Selected (1)'
      );

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

      await page.locator('body').click({ position: { x: 0, y: 0 } });

      const podVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('pod'))
        .locator('..')
        .locator('input');
      await podVariable.click();

      // length is 11 because of virtualized select options
      const podSelectOptions = dashboardPage.getByGrafanaSelector(selectors.components.Select.option).locator('..');
      await expect(podSelectOptions).toHaveCount(11);

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('All'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAA'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAB'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAC'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAD'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAE'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('BAF'))
      ).toBeVisible();
    });

    test('adding a value that is not part of dependents options should add the new values dependant options', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({
          orgId: '1',
          'var-datacenter': 'A',
          'var-server': 'AA',
          'var-pod': 'AAA',
        }),
      });

      // Click on datacenter variable dropdown
      const datacenterVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A'))
        .locator('input');
      await expect(datacenterVariable).toBeVisible();
      await datacenterVariable.click();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('B'))
        .click();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Select.toggleAllOptions)).toHaveText(
        'Selected (2)'
      );

      // Close dropdown
      await page.locator('body').click({ position: { x: 0, y: 0 } });

      // Verify datacenter shows "A,B"
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A,B')
        )
      ).toBeVisible();

      const serverVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AA'))
        .locator('input');
      await expect(serverVariable).toBeVisible();
      await serverVariable.click();

      const serverSelectOptions = dashboardPage.getByGrafanaSelector(selectors.components.Select.option);
      await expect(serverSelectOptions).toHaveCount(11);

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
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('AD'))
      ).toBeVisible();

      await page.locator('body').click({ position: { x: 0, y: 0 } });

      // Click on pod variable dropdown
      const podVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('AAA'))
        .locator('input');
      await expect(podVariable).toBeVisible();
      await podVariable.click();

      // Verify pod dropdown has 10 options
      const podSelectOptions = dashboardPage.getByGrafanaSelector(selectors.components.Select.option);
      await expect(podSelectOptions).toHaveCount(10);

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

    test('removing a value that is part of dependents options should remove the new values dependant options', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({
        // can't use queryParams here because it won't work with the multiple values for each variable
        uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=A&var-datacenter=B&var-server=AA&var-server=BB&var-pod=AAA&var-pod=BBB`,
      });

      // Click on datacenter variable dropdown
      const datacenterVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('A,B'))
        .locator('input');
      await expect(datacenterVariable).toBeVisible();
      await datacenterVariable.click();

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('A'))
        .click();

      // Close dropdown
      await page.locator('body').click({ position: { x: 0, y: 0 } });

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('B')
        )
      ).toBeVisible();

      // Click on server variable dropdown
      const serverVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BB'))
        .locator('input');
      await expect(serverVariable).toBeVisible();
      await serverVariable.click();

      const serverSelectOptions = dashboardPage.getByGrafanaSelector(selectors.components.Select.option);
      await expect(serverSelectOptions).toHaveCount(10);

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

      // Close dropdown
      await page.locator('body').click({ position: { x: 0, y: 0 } });

      // Click on pod variable dropdown
      const podVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('BBB'))
        .locator('input');
      await expect(podVariable).toBeVisible();
      await podVariable.click();

      const podSelectOptions = dashboardPage.getByGrafanaSelector(selectors.components.Select.option);
      await expect(podSelectOptions).toHaveCount(10);

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
  }
);
