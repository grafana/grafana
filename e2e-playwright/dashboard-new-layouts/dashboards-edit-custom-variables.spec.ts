import { Locator } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import { flows, type Variable } from './utils';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
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
    test('can add a new custom variable', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();

      const variable: Variable = {
        type: 'custom',
        name: 'foo',
        label: 'Foo',
        value: 'one,two,three',
      };

      // common steps to add a new variable
      await flows.newEditPaneVariableClick(dashboardPage, selectors);
      await flows.newEditPanelCommonVariableInputs(dashboardPage, selectors, variable);

      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.optionsOpenButton)
        .click();

      const addButton = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.addButton
      );

      let valueInputs: Locator;
      let labelInputs: Locator;
      let moveButtons: Locator;
      let deleteButtons: Locator;

      const refetchItems = () => {
        valueInputs = dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.valueInput
        );

        labelInputs = dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.valueInput
        );

        moveButtons = dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.moveButton
        );

        deleteButtons = dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.Settings.Variables.Edit.StaticOptionsEditor.deleteButton
        );
      };

      refetchItems();

      // check we can add a new item
      expect(await valueInputs!.all()).toHaveLength(1);
      await addButton.click();
      refetchItems();
      expect(await valueInputs!.all()).toHaveLength(2);

      // fill the first item - just value, no label
      await valueInputs!.nth(0).fill('first value');

      // fill the second item - different value and label
      await valueInputs!.nth(1).fill('second value');
      await labelInputs!.nth(1).fill('second label different than value');

      // fill the third item - random value and label - this will be moved and then removed
      await addButton.click();
      refetchItems();
      await valueInputs!.nth(2).fill('third value');
      await labelInputs!.nth(2).fill('third label');

      // fill the fourth item - same value and label - this will be moved
      await addButton.click();
      refetchItems();
      await valueInputs!.nth(3).fill('fourth value');
      await labelInputs!.nth(3).fill('fourth label');

      // check we can move an item
      await moveButtons!.nth(2).dragTo(moveButtons!.nth(3));
      refetchItems();
      expect(await valueInputs!.nth(3).innerText()).toBe('third value');
      expect(await labelInputs!.nth(3).innerText()).toBe('third label');

      // check we can remove an item
      await deleteButtons!.nth(3).click();
      refetchItems();
      expect(await valueInputs!.all()).toHaveLength(3);

      // show the preview options
      const previewOptions = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption
      );
      expect(await previewOptions.nth(0).textContent()).toBe('first value');
      expect(await previewOptions.nth(1).textContent()).toBe('second label different than value');
      expect(await previewOptions.nth(2).textContent()).toBe('forth label');

      // close the modal
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.closeButton)
        .click();

      // assert variable is visible and has the correct values
      const variableLabel = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemLabels(variable.label!)
      );
      await expect(variableLabel).toBeVisible();
      await expect(variableLabel).toContainText(variable.label!);

      const values = variable.value.split(',');
      const firstValueLink = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(values[0])
      );
      await expect(firstValueLink).toBeVisible();

      // check that variable deletion works
      await dashboardPage.getByGrafanaSelector(selectors.components.EditPaneHeader.deleteButton).click();
      await expect(variableLabel).toBeHidden();
    });
  }
);
