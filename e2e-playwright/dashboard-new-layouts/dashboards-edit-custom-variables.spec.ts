import { test, expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { flows } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
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
    const getTextarea = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) =>
      dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput
      );

    const openModal = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) => {
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.optionsOpenButton)
        .click();

      await expect(getTextarea(dashboardPage, selectors)).toBeVisible();
    };

    const applyAndCloseModal = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) => {
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

    test('can add a new custom variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      await flows.addNewGenericVariable(page, dashboardPage, selectors, {
        type: 'custom',
        name: 'foo',
        label: 'Foo',
        value: '',
      });

      await openModal(dashboardPage, selectors);

      const textarea = getTextarea(dashboardPage, selectors);
      await textarea.fill('first value, second label : second value, fourth value');

      await checkPreview(dashboardPage, selectors, ['first value', 'second label', 'fourth value']);
      await applyAndCloseModal(dashboardPage, selectors);

      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels('Foo')
      );
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText('Foo');
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('first value')
        )
      ).toBeVisible();

      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.deleteButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();
      await expect(variableLabel).toBeHidden();
    });

    test('can edit a custom variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      await flows.addNewGenericVariable(page, dashboardPage, selectors, {
        type: 'custom',
        name: 'foo',
        label: 'Foo',
        value: '',
      });

      await openModal(dashboardPage, selectors);

      const textarea = getTextarea(dashboardPage, selectors);
      await textarea.fill('first value, second label : second value, fourth value');
      await applyAndCloseModal(dashboardPage, selectors);

      // make sure the variable is deselected in order to ba able interact with the content outline item
      // if not, the item is selected and does not receive click events
      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.closePane).click();

      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Sidebar.outlineButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.node('Variables')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.item('Foo')).click();
      await openModal(dashboardPage, selectors);

      await textarea.fill('first value updated, second label : second value, fourth value');

      await checkPreview(dashboardPage, selectors, ['first value updated', 'second label', 'fourth value']);
      await applyAndCloseModal(dashboardPage, selectors);

      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels('Foo')
      );
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText('Foo');
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('first value updated')
        )
      ).toBeVisible();
    });
  }
);
