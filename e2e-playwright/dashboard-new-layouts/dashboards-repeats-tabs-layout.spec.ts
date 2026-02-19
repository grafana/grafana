import { test, expect } from '@grafana/plugin-e2e';

import V2DashWithTabRepeats from '../dashboards/V2DashWithTabRepeats.json';

import {
  verifyChanges,
  saveDashboard,
  importTestDashboard,
  goToEmbeddedPanel,
  checkRepeatedTabTitles,
  groupIntoTab,
  moveTab,
  getTabPosition,
} from './utils';

const repeatTitleBase = 'Tab - ';
const newTitleBase = 'edited tab rep - ';
const repeatOptions = [1, 2, 3, 4];

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

test.use({
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Repeats - Dashboard tabs layout',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can enable tab repeats', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Tabs layout repeats - add repeats');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await groupIntoTab(page, dashboardPage, selectors);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput)
        .fill(`${repeatTitleBase}$c1`);

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.join(' + ')}`)
        )
      ).toBeVisible();

      const repeatOptionsGroup = dashboardPage.getByGrafanaSelector(
        selectors.components.OptionsGroup.group('repeat-options')
      );
      // expand repeat options dropdown
      await repeatOptionsGroup.getByRole('button').first().click();
      // find repeat variable dropdown
      await repeatOptionsGroup.getByRole('combobox').click();
      await page.getByRole('option', { name: 'c1' }).click();

      await checkRepeatedTabTitles(dashboardPage, selectors, repeatTitleBase, repeatOptions);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await checkRepeatedTabTitles(dashboardPage, selectors, repeatTitleBase, repeatOptions);
    });

    test('can update tab repeats with variable change', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - update on variable change',
        JSON.stringify(V2DashWithTabRepeats)
      );

      const c1Var = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('c1'));
      await c1Var
        .locator('..')
        .getByTestId(selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(repeatOptions.join(',')))
        .click();
      // deselect last variable option
      await dashboardPage
        .getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(`${repeatOptions.at(-1)}`)
        )
        .click();
      await page.locator('body').click({ position: { x: 0, y: 0 } }); // blur select

      // verify that repeats are present for first 3 values
      await checkRepeatedTabTitles(dashboardPage, selectors, repeatTitleBase, repeatOptions.slice(0, -1));
      // verify there is no repeat with last value
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(-1)}`))
      ).toBeHidden();
    });
    test('can update repeats in edit pane', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - update through edit pane',
        JSON.stringify(V2DashWithTabRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      // select first/original repeat tab to activate edit pane
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(0)}`))
        .click();

      const titleInput = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput
      );
      await titleInput.fill(`${newTitleBase}$c1`);
      await titleInput.blur();

      await checkRepeatedTabTitles(dashboardPage, selectors, newTitleBase, repeatOptions);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await checkRepeatedTabTitles(dashboardPage, selectors, newTitleBase, repeatOptions);
    });

    test('can update repeats after panel change', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - update repeats after panel change',
        JSON.stringify(V2DashWithTabRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).first().click();

      const panelTitleInput = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldInput('Title')
      );
      await panelTitleInput.fill('New edited panel');
      await panelTitleInput.blur();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(1)}`))
        .click();

      // intermediate step to verify tab switch happened
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 2 - Row 1 - Panel repeat 1'))
      ).toBeVisible();

      // verify edited panel title updated in repeated tab
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New edited panel'))
      ).toBeVisible();

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New edited panel'))
      ).toBeVisible();
    });

    test('can update repeats after panel change in editor', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - update repeats after panel change in editor',
        JSON.stringify(V2DashWithTabRepeats)
      );

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel')).first();
      await panel.hover();
      await page.keyboard.press('e');

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardEditPaneSplitter.primaryBody)
      ).toBeHidden(); // verifying that panel editor loaded

      const panelTitleInput = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldInput('Title')
      );
      await panelTitleInput.fill('New edited panel');
      await panelTitleInput.blur();

      // playwright too fast, verifying JSON diff that changes landed
      await verifyChanges(dashboardPage, page, selectors, 'New edited panel');

      // verify panel title change in panel editor UI
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(`New edited panel`))
      ).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.DashboardEditPaneSplitter.primaryBody)
      ).toBeVisible(); // verifying that dashboard loaded

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(1)}`))
        .click();

      // intermediate step to verify tab switch happened
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 2 - Row 1 - Panel repeat 1'))
      ).toBeVisible();

      // verify edited panel title updated in repeated tab
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New edited panel'))
      ).toBeVisible();

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      // verify edited panel title updated in repeated tab
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New edited panel'))
      ).toBeVisible();
    });

    test('can hide canvas grid add row action in repeats', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - hide canvas add action in repeats',
        JSON.stringify(V2DashWithTabRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow)).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(1)}`))
        .click();

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addRow)).toBeHidden();
    });

    test('can move repeated tabs', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - move repeated tabs',
        JSON.stringify(V2DashWithTabRepeats)
      );
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await moveTab(dashboardPage, page, selectors, `${repeatTitleBase}${repeatOptions.at(0)}`, 'New tab');

      // playwright too fast - adding intermediate step so that UI has time to update
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab')).click();

      // verify move by tab position
      const repeatedTab = await getTabPosition(dashboardPage, selectors, `${repeatTitleBase}${repeatOptions.at(0)}`);
      const normalTab = await getTabPosition(dashboardPage, selectors, 'New tab');
      expect(normalTab?.x).toBeLessThan(repeatedTab?.x || 0);
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      const repeatedTab2 = await getTabPosition(dashboardPage, selectors, `${repeatTitleBase}${repeatOptions.at(0)}`);
      const normalTab2 = await getTabPosition(dashboardPage, selectors, 'New tab');
      expect(normalTab2?.x).toBeLessThan(repeatedTab2?.x || 0);
    });

    test('can load into repeated tab', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - can load into repeated tab',
        JSON.stringify(V2DashWithTabRepeats)
      );

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(2)}`))
        .click();

      await page.reload();

      await expect(page.locator('[data-testid="uplot-main-div"]').first()).toBeVisible();

      expect(
        await dashboardPage
          .getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(2)}`))
          .getAttribute('aria-selected')
      ).toBe('true');
    });

    test('can view panels in repeated tab', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - view panels in repeated tabs',
        JSON.stringify(V2DashWithTabRepeats)
      );

      // non repeated panel in repeated tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel')).first().hover();
      await page.keyboard.press('v');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 1 - Row 1 - Panel repeat 1'))
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toBeVisible();

      await page.reload();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toBeVisible();

      await page.keyboard.press('Escape');

      // repeated panel in original tab repeat
      await dashboardPage
        .getByGrafanaSelector(selectors.components.DashboardRow.title('Row 2'))
        .scrollIntoViewIfNeeded();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 1 - Row 2 - Panel repeat 2'))
        .hover();
      await page.keyboard.press('v');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 1 - Row 1 - Panel repeat 1'))
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 1 - Row 2 - Panel repeat 2'))
      ).toBeVisible();

      await page.reload();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 1 - Row 2 - Panel repeat 2'))
      ).toBeVisible();

      await page.keyboard.press('Escape');

      // repeated panel in repeated tab
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(2)}`))
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.DashboardRow.title('Row 2'))
        .scrollIntoViewIfNeeded();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 3 - Row 2 - Panel repeat 2'))
        .hover();
      await page.keyboard.press('v');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 3 - Row 1 - Panel repeat 1'))
      ).toBeHidden();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 3 - Row 2 - Panel repeat 2'))
      ).toBeVisible();

      await page.reload();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 3 - Row 2 - Panel repeat 2'))
      ).toBeVisible();
    });

    test('can view embedded panels in repeated tab', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - view embedded panels in repeated tabs',
        JSON.stringify(V2DashWithTabRepeats)
      );

      const dashUrl = page.url();

      // non repeated panel in repeated tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel')).first().hover();
      await page.keyboard.press('p+e');
      await goToEmbeddedPanel(page);
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('New panel'))
      ).toBeVisible();
      await page.goto(dashUrl);

      // repeated panel in original tab repeat
      await dashboardPage
        .getByGrafanaSelector(selectors.components.DashboardRow.title('Row 2'))
        .scrollIntoViewIfNeeded();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 1 - Row 2 - Panel repeat 2'))
        .hover();
      await page.keyboard.press('p+e');
      await goToEmbeddedPanel(page);
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 1 - Row 2 - Panel repeat 2'))
      ).toBeVisible();
      await page.goto(dashUrl);

      // repeated panel in repeated tab
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(2)}`))
        .click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.DashboardRow.title('Row 2'))
        .scrollIntoViewIfNeeded();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 3 - Row 2 - Panel repeat 2'))
        .hover();
      await page.keyboard.press('p+e');
      await goToEmbeddedPanel(page);
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Tab 3 - Row 2 - Panel repeat 2'))
      ).toBeVisible();
    });

    test('can remove repeats', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Tabs layout repeats - remove repeats',
        JSON.stringify(V2DashWithTabRepeats)
      );

      // verify 5 tabs are present (4 repeats and 1 normal)
      await checkRepeatedTabTitles(dashboardPage, selectors, repeatTitleBase, repeatOptions);
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(0)}`))
        .click();

      const repeatOptionsGroup = dashboardPage.getByGrafanaSelector(
        selectors.components.OptionsGroup.group('repeat-options')
      );
      // expand repeat options dropdown
      await repeatOptionsGroup.getByRole('button').first().click();
      // find repeat variable dropdown
      await repeatOptionsGroup.getByRole('combobox').click();
      await page.getByRole('option', { name: 'Disable repeating' }).click();

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.join(' + ')}`)
        )
      ).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(1)}`))
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(2)}`))
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(3)}`))
      ).toBeHidden();

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.join(' + ')}`)
        )
      ).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab'))).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(1)}`))
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(2)}`))
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`${repeatTitleBase}${repeatOptions.at(3)}`))
      ).toBeHidden();
    });
  }
);
