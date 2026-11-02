import { type Locator, type Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import { dragTo } from '../helpers';
import { type Sidebar } from '../page-objects';

import variableListDashboard from './fixtures/VariableListDashboard.json';
import { importVariableTestDashboard, saveAndGotoDashboardUrl } from './helpers/flows';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  viewport: { width: 1920, height: 1080 },
});

/**
 * Drags a variable of the sidebar list and drops it on the target
 * @param position 'top' drops above the target item, 'middle' drops into the target list
 */
async function dragVariable(
  page: Page,
  variableList: Sidebar['dashboardOptions']['variableList'],
  variableName: string,
  target: Locator,
  position: 'top' | 'middle'
) {
  const variable = variableList.getItem(variableName);
  // we hover first so the target is measured after any scroll the hover causes
  await variable.hover();
  const box = await target.boundingBox();
  expect(box, 'The drop target should have a bounding box').not.toBeNull();

  const y = position === 'top' ? box!.y : box!.y + box!.height / 2;
  // pangea needs several intermediate mousemove events to follow the drag
  await dragTo(page, `variable "${variableName}"`, variable, box!.x + box!.width / 2, y, { steps: 10 });
}

test.describe(
  'Dashboard edit - variable list',
  {
    tag: ['@dashboards'],
  },
  () => {
    // One test on a single imported dashboard, because each import and edit-mode entry is the slowest part of the run.
    test('reorders, moves, duplicates and deletes variables, and keeps the order and placement after a reload', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
    }) => {
      // the dashboard has 4 textbox variables (env=prod, region=eu, cluster=alpha, instance=web1), all above the dashboard
      const viewUrl = await importVariableTestDashboard(page, selectors, panels, variableListDashboard);
      const variableControls = controls.variables.getControls();
      await expect(variableControls).toHaveText(['env', 'region', 'cluster', 'instance']);

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Options');
      const { variableList } = sidebar.dashboardOptions;

      await test.step('Reorder the variables above the dashboard', async () => {
        await dragVariable(page, variableList, 'instance', variableList.getItem('env'), 'top');

        await expect(variableList.getItems('Above dashboard')).toHaveText(['instance', 'env', 'region', 'cluster']);
        await expect(variableControls).toHaveText(['instance', 'env', 'region', 'cluster']);
      });

      await test.step('Move a variable to the controls menu and another one to hidden', async () => {
        // We expand both lists because an empty list starts collapsed and stays so after a drop, hiding its items.
        await variableList.expand('Controls menu');
        await variableList.expand('Hidden');

        await dragVariable(page, variableList, 'region', variableList.getList('Controls menu'), 'middle');
        await expect(variableList.getItems('Controls menu')).toHaveText(['region']);

        await dragVariable(page, variableList, 'cluster', variableList.getList('Hidden'), 'middle');
        await expect(variableList.getItems('Hidden')).toHaveText(['cluster']);

        await expect(variableList.getItems('Above dashboard')).toHaveText(['instance', 'env']);
        // Both the controls menu variable and the hidden one leave the controls bar.
        await expect(variableControls).toHaveText(['instance', 'env']);
      });

      await test.step('Duplicate a variable from the variables list', async () => {
        await variableList.duplicate('env');

        // We expect "env_copy4" because the copy is named after the original and the variable count, and the copy gets selected.
        await expect(sidebar.variableOptions.getNameInput()).toHaveValue('env_copy4');
        await expect(sidebar.variableOptions.textbox.getValueInput()).toHaveValue('prod');

        await sidebar.toolbar.clickButton('Options');
        await expect(variableList.getItems('Above dashboard')).toHaveText(['instance', 'env', 'env_copy4']);
      });

      await test.step('Delete a variable from the variables list', async () => {
        await variableList.delete('instance');

        await expect(variableList.getItems('Above dashboard')).toHaveText(['env', 'env_copy4']);
        await expect(variableControls).toHaveText(['env', 'env_copy4']);
      });

      await saveAndGotoDashboardUrl(page, controls, viewUrl);

      // We check the panel because it proves the hidden variable still interpolates and the deleted one no longer resolves.
      const markdownContent = panels.getBody('Variable output').locator('.markdown-html');
      await expect(markdownContent).toHaveText('env=prod region=eu cluster=alpha instance=$instance');

      await expect(variableControls).toHaveText(['env', 'env_copy4']);

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Options');

      await expect(variableList.getItems('Above dashboard')).toHaveText(['env', 'env_copy4']);
      await expect(variableList.getItems('Controls menu')).toHaveText(['region']);
      await expect(variableList.getItems('Hidden')).toHaveText(['cluster']);

      await controls.exitEditMode();
      await controls.openControlsMenu();
      await expect(controls.variables.getLabel('region')).toBeVisible();
      await expect(controls.variables.getLabel('cluster')).toBeHidden();
    });
  }
);
