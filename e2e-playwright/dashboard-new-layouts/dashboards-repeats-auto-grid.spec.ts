import { Page } from 'playwright-core';

import { test, expect } from '@grafana/plugin-e2e';

import testV2DashWithRepeats from '../dashboards/V2DashWithRepeats.json';

import {
  checkRepeatedPanelTitles,
  saveDashboard,
  verifyChanges,
  movePanel,
  getPanelPosition,
  importTestDashboard,
  goToEmbeddedPanel,
} from './utils';

const repeatTitleBase = 'repeat - ';
const newTitleBase = 'edited rep - ';
const repeatOptions = [1, 2, 3, 4];

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

test.use({
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Repeats - Dashboard auto grid',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can enable repeats', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Auto grid repeats - add repeats');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await switchToAutoGrid(page);

      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel')).first().click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'))
        .fill(`${repeatTitleBase}$c1`);

      const repeatOptionsGroup = dashboardPage.getByGrafanaSelector(
        selectors.components.OptionsGroup.group('repeat-options')
      );
      // expand repeat options dropdown
      await repeatOptionsGroup.getByRole('button').first().click();
      // find repeat variable dropdown
      await repeatOptionsGroup.getByRole('combobox').click();
      await page.getByRole('option', { name: 'c1' }).click();

      await checkRepeatedPanelTitles(dashboardPage, selectors, repeatTitleBase, repeatOptions);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await checkRepeatedPanelTitles(dashboardPage, selectors, repeatTitleBase, repeatOptions);
    });

    test('can update repeats with variable change', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Auto grid repeats - update on variable change',
        JSON.stringify(testV2DashWithRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await switchToAutoGrid(page);
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await dashboardPage
        .getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(repeatOptions.join(','))
        )
        .click();

      // deselect last variable option
      await dashboardPage
        .getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(`${repeatOptions.at(-1)}`)
        )
        .click();
      await page.locator('body').click({ position: { x: 0, y: 0 } }); // blur select

      // verify that repeats are present for first 3 values
      await checkRepeatedPanelTitles(dashboardPage, selectors, repeatTitleBase, repeatOptions.slice(0, -1));

      // verify there is no repeat with last value
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(-1)}`)
        )
      ).toBeHidden();
    });
    test('can update repeats in edit pane', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Auto grid repeats - update through edit pane',
        JSON.stringify(testV2DashWithRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await switchToAutoGrid(page);

      // select first/original repeat panel to activate edit pane
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(0)}`))
        .click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'))
        .fill(`${newTitleBase}$c1`);
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title')).blur();

      await checkRepeatedPanelTitles(dashboardPage, selectors, newTitleBase, repeatOptions);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await checkRepeatedPanelTitles(dashboardPage, selectors, newTitleBase, repeatOptions);
    });

    test('can update repeats in panel editor', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Auto grid repeats - update through panel editor',
        JSON.stringify(testV2DashWithRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await switchToAutoGrid(page);
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // selecting last repeat
      const panel = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(-1)}`)
      );
      await panel.hover();
      await page.keyboard.press('e');

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardEditPaneSplitter.primaryBody)
      ).toBeHidden(); // verifying that panel editor loaded

      // verify original repeat panel is loaded
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(0)}`)
        )
      ).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'))
        .fill(`${newTitleBase}$c1`);
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title')).blur();

      // playwright too fast, verifying JSON diff that changes landed
      await verifyChanges(dashboardPage, page, selectors, newTitleBase);

      // verify panel title change in panel editor UI
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${newTitleBase}${repeatOptions.at(0)}`)
        )
      ).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardEditPaneSplitter.primaryBody)
      ).toBeVisible(); // verifying that dashboard loaded

      await checkRepeatedPanelTitles(dashboardPage, selectors, newTitleBase, repeatOptions);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await checkRepeatedPanelTitles(dashboardPage, selectors, newTitleBase, repeatOptions);
    });

    test('can update repeats in panel editor when loaded directly', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Auto grid repeats - update through directly loaded panel editor',
        JSON.stringify(testV2DashWithRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await switchToAutoGrid(page);
      await saveDashboard(dashboardPage, page, selectors);

      // loading directly into panel editor
      await page.goto(`${page.url()}&editPanel=1`);

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardEditPaneSplitter.primaryBody)
      ).toBeHidden(); // verifying that panel editor loaded

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(0)}`)
        )
      ).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title'))
        .fill(`${newTitleBase}$c1`);

      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldInput('Title')).blur();

      // playwright too fast, verifying JSON diff that changes landed
      await verifyChanges(dashboardPage, page, selectors, newTitleBase);

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${newTitleBase}${repeatOptions.at(0)}`)
        )
      ).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardEditPaneSplitter.primaryBody)
      ).toBeVisible(); // verifying that dashboard loaded

      await checkRepeatedPanelTitles(dashboardPage, selectors, newTitleBase, repeatOptions);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await checkRepeatedPanelTitles(dashboardPage, selectors, newTitleBase, repeatOptions);
    });
    test('can move repeated panels', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Auto grid repeats - move repeated panels',
        JSON.stringify(testV2DashWithRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await switchToAutoGrid(page);

      // this moving repeated panel between two normal panels
      await movePanel(dashboardPage, selectors, `${repeatTitleBase}${repeatOptions.at(0)}`, 'New panel');

      //  verify move by panel title order
      expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).first()).toHaveText(
        'New panel'
      );
      expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).last()).toHaveText(
        'New panel'
      );

      // verify move by panel position
      let repeatedPanel = await getPanelPosition(dashboardPage, selectors, `${repeatTitleBase}${repeatOptions.at(0)}`);
      let normalPanel = await getPanelPosition(dashboardPage, selectors, 'New panel');
      expect(normalPanel?.x).toBeLessThan(repeatedPanel?.x || 0);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      const repeatedPanel2 = await getPanelPosition(
        dashboardPage,
        selectors,
        `${repeatTitleBase}${repeatOptions.at(0)}`
      );

      const normalPanel2 = await getPanelPosition(dashboardPage, selectors, 'New panel');

      expect(normalPanel2?.x).toBeLessThan(repeatedPanel2?.x || 0);
      expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).first()).toHaveText(
        'New panel'
      );
      expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).last()).toHaveText(
        'New panel'
      );
    });
    test('can view repeated panel', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Auto grid repeats - move repeated panels',
        JSON.stringify(testV2DashWithRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await switchToAutoGrid(page);
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(-1)}`))
        .hover();
      await page.keyboard.press('v');

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(0)}`)
        )
      ).toBeHidden();

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(-1)}`)
        )
      ).toBeVisible();

      const repeatedPanelUrl = page.url();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(0)}`))
        .hover();
      await page.keyboard.press('v');

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(-1)}`)
        )
      ).toBeHidden();

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(0)}`)
        )
      ).toBeVisible();

      // load view panel directly
      await page.goto(repeatedPanelUrl);

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(-1)}`)
        )
      ).toBeVisible();
    });

    test('can view embedded repeated panel', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Auto grid repeats - view embedded repeated panel',
        JSON.stringify(testV2DashWithRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await switchToAutoGrid(page);
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(-1)}`))
        .hover();
      await page.keyboard.press('p+e');

      await goToEmbeddedPanel(page);

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(-1)}`)
        )
      ).toBeVisible();
    });
    test('can remove repeats', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Auto grid repeats - remove repeats',
        JSON.stringify(testV2DashWithRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await switchToAutoGrid(page);
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(page.locator('[data-testid="uplot-main-div"]').first()).toBeVisible();

      // verify 6 panels are present (4 repeats and 2 normal)
      expect(
        await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).all()
      ).toHaveLength(6);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(0)}`))
        .click();

      const repeatOptionsGroup = dashboardPage.getByGrafanaSelector(
        selectors.components.OptionsGroup.group('repeat-options')
      );
      // expand repeat options dropdown
      await repeatOptionsGroup.getByRole('button').first().click();
      // find repeat variable dropdown
      await repeatOptionsGroup.getByRole('combobox').first().click();
      await page.getByRole('option', { name: 'Disable repeating' }).click();

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.join(' + ')}`)
        )
      ).toBeVisible();

      // verify only 3 panels are present
      expect(
        await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).all()
      ).toHaveLength(3);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.join(' + ')}`)
        )
      ).toBeVisible();

      expect(
        await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).all()
      ).toHaveLength(3);
    });
  }
);

async function switchToAutoGrid(page: Page) {
  await page.getByLabel('Expand Panel layout category').click();
  await page.getByLabel('Auto grid').click();
}
