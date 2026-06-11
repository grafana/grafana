import { type Locator } from '@playwright/test';

import { test, expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { flows } from './utils';

test.use({
  featureToggles: {
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

test.use({
  viewport: { width: 1920, height: 1080 },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';
const DASHBOARD_NAME = 'Test variable output';

test.describe(
  'Dashboard edit - Custom variable',
  {
    tag: ['@dashboards'],
  },
  () => {
    let variableValueInput: Locator | undefined;

    const refetchItems = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) => {
      variableValueInput = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.ElementEditPane.CustomVariable.customValueInput
      );
    };

    const fillValue = async (value: string) => {
      await variableValueInput!.fill(value);
    };

    const openModal = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) => {
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.optionsOpenButton)
        .click();

      refetchItems(dashboardPage, selectors);
    };

    const applyAndcloseModal = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) => {
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.applyButton)
        .click();
    };

    const checkPreview = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups, labels: string[]) => {
      const previewOptions = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
      );

      for (let i = 0; i < labels.length; i++) {
        expect(await previewOptions.nth(i).textContent()).toBe(labels[i]);
      }
    };

    test.beforeEach(() => {
      variableValueInput = undefined;
    });

    test('can add a new custom variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      // common steps to add a new variable
      await flows.addNewGenericVariable(page, dashboardPage, selectors, {
        type: 'custom',
        name: 'foo',
        label: 'Foo',
        value: '',
      });

      await openModal(dashboardPage, selectors);
      await fillValue('first label : 0, second label : second value, third value, fourth value');
      await checkPreview(dashboardPage, selectors, ['first label', 'second label', 'third value', 'fourth value']);
      await applyAndcloseModal(dashboardPage, selectors);

      // assert variable is visible and has the correct values
      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels('Foo')
      );
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText('Foo');
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('0')
        )
      ).toBeVisible();

      // check that changing variable value works
      await openModal(dashboardPage, selectors);
      await fillValue('test : 1');
      await checkPreview(dashboardPage, selectors, ['test']);
      await applyAndcloseModal(dashboardPage, selectors);
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('1')
        )
      ).toBeVisible();

      // check that variable deletion works
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.deleteButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();
      await expect(variableLabel).toBeHidden();
    });
  }
);
