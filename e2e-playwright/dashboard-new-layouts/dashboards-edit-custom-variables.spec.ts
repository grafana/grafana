import { Locator } from '@playwright/test';

import { test, expect, DashboardPage, E2ESelectorGroups } from '@grafana/plugin-e2e';

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
    let addButton: Locator | undefined;
    let rows: Locator | undefined;
    let valueInputs: Locator | undefined;
    let labelInputs: Locator | undefined;
    let deleteButtons: Locator | undefined;

    const getAddButton = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) => {
      addButton = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.addButton
      );
      await expect(addButton).toBeVisible();
    };

    const refetchItems = (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) => {
      rows = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.row
      );

      valueInputs = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.valueInput
      );

      labelInputs = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.labelInput
      );

      deleteButtons = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.deleteButton
      );
    };

    const checkRows = async (length: number) => {
      expect(await rows!.all()).toHaveLength(length);
    };

    const fillValue = async (text: string, index: number) => {
      await valueInputs!.nth(index).fill(text);
    };

    const fillLabel = async (text: string, index: number) => {
      await labelInputs!.nth(index).fill(text);
    };

    const fillLabelValue = async (value: string, label: string, index: number) => {
      await fillValue(value, index);
      await fillLabel(label, index);
    };

    const openModal = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) => {
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.optionsOpenButton)
        .click();

      await getAddButton(dashboardPage, selectors);

      refetchItems(dashboardPage, selectors);
    };

    const applyAndcloseModal = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups) => {
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.applyButton)
        .click();
    };

    const checkItems = async (items: Array<[string, string?]>) => {
      for (let i = 0; i < items.length; i++) {
        const [value, label] = items[i];
        await expect(valueInputs!.nth(i)).toHaveValue(value);
        await expect(labelInputs!.nth(i)).toHaveValue(label ?? '');
      }
    };

    const checkPreview = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups, labels: string[]) => {
      const previewOptions = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
      );

      for (let i = 0; i < labels.length; i++) {
        expect(await previewOptions.nth(i).textContent()).toBe(labels[i]);
      }
    };

    const addItem = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups, value = '', label = '') => {
      await addButton!.click();
      refetchItems(dashboardPage, selectors);
      await fillLabelValue(value ?? '', label ?? '', (await rows!.all()).length - 1);
    };

    const removeItem = async (dashboardPage: DashboardPage, selectors: E2ESelectorGroups, index: number) => {
      await deleteButtons!.nth(index).click();
      refetchItems(dashboardPage, selectors);
    };

    test.beforeEach(() => {
      valueInputs = undefined;
      labelInputs = undefined;
      deleteButtons = undefined;
    });

    test('can add a new custom variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      // common steps to add a new variable
      await flows.newEditPaneVariableClick(dashboardPage, selectors);
      await flows.newEditPanelCommonVariableInputs(dashboardPage, selectors, {
        type: 'custom',
        name: 'foo',
        label: 'Foo',
        value: '',
      });

      await openModal(dashboardPage, selectors);
      await checkRows(1);
      await addItem(dashboardPage, selectors);
      await checkRows(2);
      await fillValue('first value', 0);
      await fillLabelValue('second value', 'second label', 1);
      await addItem(dashboardPage, selectors, 'third value', 'third label');
      await addItem(dashboardPage, selectors, 'fourth value', 'fourth value');
      await removeItem(dashboardPage, selectors, 2);
      await checkRows(3);
      await checkPreview(dashboardPage, selectors, ['first value', 'second label', 'fourth value']);
      await applyAndcloseModal(dashboardPage, selectors);

      // assert variable is visible and has the correct values
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

      // check that variable deletion works
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.deleteButton).click();
      await expect(variableLabel).toBeHidden();
    });

    test('can edit a custom variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: PAGE_UNDER_TEST,
        queryParams: new URLSearchParams({ orgId: '1', editview: 'variables' }),
      });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      // Create a custom variable in the dashboard settings page
      await dashboardPage.getByGrafanaSelector(selectors.components.CallToActionCard.buttonV2('Add variable')).click();
      const typeSelect = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2)
        .locator('input');
      await typeSelect.fill('Custom');
      await typeSelect.press('Enter');
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2)
        .fill('foo');
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2)
        .fill('Foo');
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput)
        .fill('first value, second label : second value, fourth value : fourth value');
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton)
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();

      // Open the modal editor in the side pane
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Sidebar.outlineButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.node('Variables')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.item('foo')).click();
      await openModal(dashboardPage, selectors);

      // Check the items
      await checkItems([['first value'], ['second value', 'second label'], ['fourth value']]);
      await checkPreview(dashboardPage, selectors, ['first value', 'second label', 'fourth value']);
    });
  }
);
