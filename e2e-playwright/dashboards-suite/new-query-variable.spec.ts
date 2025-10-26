import { test, expect } from '@grafana/plugin-e2e';

const PAGE_UNDER_TEST = '-Y-tnEDWk/templating-nested-template-variables';
const DASHBOARD_NAME = 'Templating - Nested Template Variables';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Variables - Query - Add variable',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('query variable should be default and default fields should be correct', async ({
      page,
      gotoDashboardPage,
      selectors,
    }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({ orgId: '1', editview: 'variables' }),
      });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      await page.getByTestId(selectors.pages.Dashboard.Settings.Variables.List.newButton).click();
      const nameInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2
      );
      await expect(nameInput).toBeVisible();
      await expect(nameInput).toHaveAttribute('placeholder', 'Variable name');
      await expect(nameInput).toHaveValue('query0');

      const typeSelect = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2
      );
      await expect(typeSelect).toBeVisible();
      const singleValue = typeSelect.locator('div[class*="-singleValue"]');
      await expect(singleValue).toHaveText('Query');

      const labelInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2
      );
      await expect(labelInput).toBeVisible();
      await expect(labelInput).toHaveAttribute('placeholder', 'Label name');
      await expect(labelInput).toHaveValue('');

      const descriptionInput = page.locator('[placeholder="Descriptive text"]');
      await expect(descriptionInput).toBeVisible();
      await expect(descriptionInput).toHaveAttribute('placeholder', 'Descriptive text');
      await expect(descriptionInput).toHaveValue('');

      await expect(page.locator('label').filter({ hasText: 'Hide' })).toBeVisible();

      // Check datasource selector
      const datasourceSelect = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect
      );
      await expect(datasourceSelect).toBeVisible();
      await expect(datasourceSelect).toHaveAttribute('placeholder', 'gdev-testdata');

      await expect(page.locator('label').filter({ hasText: 'Refresh' })).toBeVisible();
      await expect(page.locator('label').filter({ hasText: 'On dashboard load' })).toBeVisible();

      const regexInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2
      );
      await expect(regexInput).toBeVisible();
      await expect(regexInput).toHaveAttribute('placeholder', '/.*-(?<text>.*)-(?<value>.*)-.*/');
      await expect(regexInput).toHaveValue('');

      const sortSelect = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelectV2
      );
      await expect(sortSelect).toBeVisible();
      const sortSingleValue = sortSelect.locator('div[class*="-singleValue"]');
      await expect(sortSingleValue).toHaveText('Disabled');

      // Check Multi-value checkbox
      const multiValueLabel = page.locator('label').filter({ hasText: 'Multi-value' });
      const multiValueCheckbox = multiValueLabel.locator('input[type="checkbox"]');
      await expect(multiValueCheckbox).toBeChecked({
        checked: false,
      });

      // Check Include All option checkbox
      const includeAllLabel = page.locator('label').filter({ hasText: 'Include All option' });
      const includeAllCheckbox = includeAllLabel.locator('input[type="checkbox"]');
      await expect(includeAllCheckbox).toBeChecked({
        checked: false,
      });

      // Check preview and custom all input don't exist initially
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
        )
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
        )
      ).toBeHidden();
    });

    test('adding a single value query variable', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({ orgId: '1', editview: 'variables' }),
      });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      // Click the "New" button to add a variable
      await page.getByTestId(selectors.pages.Dashboard.Settings.Variables.List.newButton).click();

      const labelInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2
      );
      await labelInput.fill('a label');
      const descriptionInput = page.locator('[placeholder="Descriptive text"]');
      await descriptionInput.fill('a description');
      const datasourcePicker = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.inputV2);
      await datasourcePicker.fill('gdev-testdata');
      const datasourceList = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.dataSourceList);
      await datasourceList.getByText('gdev-testdata').click();
      const queryInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput
      );
      await queryInput.fill('*');
      const regexInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2
      );
      await regexInput.fill('/.*C.*/');
      await regexInput.blur();

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
        )
      ).toBeVisible();

      // Navigate back to dashboard
      const submitButton = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton
      );
      await submitButton.click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();

      // Check variable appears in submenu
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('a label'))
      ).toBeVisible();

      const submenuItems = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem);
      await expect(submenuItems).toHaveCount(4);
      const fourthItem = submenuItems.nth(3);
      const input = fourthItem.locator('input');
      await input.click();

      // Check dropdown has 1 option containing 'C'
      const options = dashboardPage.getByGrafanaSelector(selectors.components.Select.option);
      await expect(options).toHaveCount(1);
      await expect(options).toContainText('C');
    });

    test('adding a multi value query variable', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({ orgId: '1', editview: 'variables' }),
      });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      await page.getByTestId(selectors.pages.Dashboard.Settings.Variables.List.newButton).click();

      const labelInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2
      );
      await labelInput.fill('a label');
      const descriptionInput = page.locator('[placeholder="Descriptive text"]');
      await descriptionInput.fill('a description');
      const datasourcePicker = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.inputV2);
      await datasourcePicker.fill('gdev-testdata');
      const datasourceList = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.dataSourceList);
      await datasourceList.getByText('gdev-testdata').click();
      const queryInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput
      );
      await queryInput.fill('*');
      const regexInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2
      );
      await regexInput.fill('/.*C.*/');

      // Enable Multi-value
      const multiValueLabel = page.locator('label').filter({ hasText: 'Multi-value' });
      const multiValueCheckbox = multiValueLabel.locator('input[type="checkbox"]');
      await multiValueCheckbox.click({ force: true });
      await expect(multiValueCheckbox).toBeChecked();

      // Enable Include All option
      const includeAllLabel = page.locator('label').filter({ hasText: 'Include All option' });
      const includeAllCheckbox = includeAllLabel.locator('input[type="checkbox"]');
      await includeAllCheckbox.click({ force: true });
      await expect(includeAllCheckbox).toBeChecked();

      const customAllInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
      );
      await expect(customAllInput).toHaveValue('');

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
        )
      ).toHaveCount(2);

      // Navigate back to dashboard
      const submitButton = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton
      );
      await submitButton.click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();

      // Check variable appears in submenu
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('a label'))
      ).toBeVisible();

      const submenuItems = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem);
      await expect(submenuItems).toHaveCount(4);

      const fourthItem = submenuItems.nth(3);
      const input = fourthItem.locator('input');
      await input.click();

      // Check dropdown has 3 options (All + filtered results)
      const options = dashboardPage.getByGrafanaSelector(selectors.components.Select.option);
      await expect(options).toHaveCount(3);

      // Check toggle shows Selected (1)
      const toggleAll = dashboardPage.getByGrafanaSelector(selectors.components.Select.toggleAllOptions);
      await expect(toggleAll).toHaveText('Selected (1)');

      // Check options contain 'All' and 'C'
      await expect(options.filter({ hasText: 'All' })).toBeVisible();
      // need to use regex here else this will also match "Selected"
      await expect(options.filter({ hasText: /^C$/ })).toBeVisible();
    });
  }
);
