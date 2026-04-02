import { test, expect } from '@grafana/plugin-e2e';

import testV2DashWithRepeats from '../dashboards/V2DashWithRepeats.json';
import testV2DashWithRowRepeats from '../dashboards/V2DashWithRowRepeats.json';

import {
  checkRepeatedPanelTitles,
  verifyChanges,
  movePanel,
  getPanelPosition,
  saveDashboard,
  importTestDashboard,
  goToEmbeddedPanel,
  goToPanelSnapshot,
} from './utils';

const repeatTitleBase = 'repeat - ';
const newTitleBase = 'edited rep - ';
const repeatOptions = [1, 2, 3, 4];
const getTitleInRepeatRow = (rowIndex: number, panelIndex: number) =>
  `repeated-row-${rowIndex}-repeated-panel-${panelIndex}`;

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
  'Repeats - Dashboard custom grid',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can enable repeats', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(page, selectors, 'Custom grid repeats - add repeats');

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).first().click();

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
        'Custom grid repeats - update on variable change',
        JSON.stringify(testV2DashWithRepeats)
      );

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
        'Custom grid repeats - update through edit pane',
        JSON.stringify(testV2DashWithRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // select first/original repeat panel to activate edit pane
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(0)}`))
        .getByTestId(selectors.components.Panels.Panel.headerContainer)
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
        'Custom grid repeats - update through panel editor',
        JSON.stringify(testV2DashWithRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // selecting last repeat
      const panel = dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(-1)}`))
        .getByTestId(selectors.components.Panels.Panel.headerContainer);

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

      await page.keyboard.press('Escape');

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
        'Custom grid repeats - update through directly loaded panel editor',
        JSON.stringify(testV2DashWithRepeats)
      );

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

      await page.keyboard.press('Escape');

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
        'Custom grid repeats - move repeated panels',
        JSON.stringify(testV2DashWithRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await movePanel(dashboardPage, selectors, `${repeatTitleBase}${repeatOptions.at(0)}`, 'New panel');

      // verify move by panel title order
      expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).first()).toHaveText(
        'New panel'
      );
      expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).last()).toHaveText(
        `${repeatTitleBase}${repeatOptions.at(-1)}`
      );

      // verify move by panel position
      let repeatedPanel = await getPanelPosition(dashboardPage, selectors, `${repeatTitleBase}${repeatOptions.at(0)}`);
      let normalPanel = await getPanelPosition(dashboardPage, selectors, 'New panel');
      expect(normalPanel?.y).toBeLessThan(repeatedPanel?.y || 0);

      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      const repeatedPanel2 = await getPanelPosition(
        dashboardPage,
        selectors,
        `${repeatTitleBase}${repeatOptions.at(0)}`
      );

      const normalPanel2 = await getPanelPosition(dashboardPage, selectors, 'New panel');

      expect(normalPanel2?.y).toBeLessThan(repeatedPanel2?.y || 0);
      expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).first()).toHaveText(
        'New panel'
      );
      expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).last()).toHaveText(
        `${repeatTitleBase}${repeatOptions.at(-1)}`
      );
    });
    test('can view repeated panel', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Custom grid repeats - move repeated panels',
        JSON.stringify(testV2DashWithRepeats)
      );

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

      await page.keyboard.press('Escape');

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
        'Custom grid repeats - view embedded repeated panel',
        JSON.stringify(testV2DashWithRepeats)
      );

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
        'Custom grid repeats - remove repeats',
        JSON.stringify(testV2DashWithRepeats)
      );

      // verify 6 panels are present (4 repeats and 2 normal)
      expect(
        await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).all()
      ).toHaveLength(6);

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(`${repeatTitleBase}${repeatOptions.at(0)}`))
        .getByTestId(selectors.components.Panels.Panel.headerContainer)
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

    test('can view repeated panel in a repeated row', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Custom grid repeats - view repeated panel in a repeated row',
        JSON.stringify(testV2DashWithRowRepeats)
      );

      // make sure the repeated panel is present in multiple rows
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(1, 1)))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(2, 2)))
      ).toBeVisible();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(1, 1)))
        .hover();

      await page.keyboard.press('v');

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(2, 2)))
      ).not.toBeVisible();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(1, 1)))
      ).toBeVisible();

      const repeatedPanelUrl = page.url();

      await page.keyboard.press('Escape');

      // load view panel directly
      await page.goto(repeatedPanelUrl);

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(1, 1)))
      ).toBeVisible();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(2, 2)))
      ).not.toBeVisible();
    });

    test('can view embedded panel in a repeated row', async ({ dashboardPage, selectors, page }) => {
      const embedPanelTitle = 'embedded-panel';
      await importTestDashboard(
        page,
        selectors,
        'Custom grid repeats - view embedded repeated panel in a repeated row',
        JSON.stringify(testV2DashWithRowRepeats)
      );

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(1, 1)))
        .hover();
      await page.keyboard.press('p+e');

      await goToEmbeddedPanel(page);

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(1, 1)))
      ).toBeVisible();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(2, 2)))
      ).not.toBeVisible();
    });

    // there is a bug in the Snapshot feature that prevents the next two tests from passing
    // tracking issue: https://github.com/grafana/grafana/issues/114509
    test.skip('can view repeated panel inside snapshot', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Custom grid repeats - view repeated panel inside snapshot',
        JSON.stringify(testV2DashWithRowRepeats)
      );

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(1, 1)))
        .hover();
      await page.keyboard.press('p+s');

      // click "Publish snapshot"
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareSnapshot.publishSnapshot)
        .click();

      // click "Copy link" button in the snapshot drawer
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareSnapshot.copyUrlButton)
        .click();

      await goToPanelSnapshot(page);

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(1, 1)))
      ).toBeVisible();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(2, 2)))
      ).not.toBeVisible();
    });
    test.skip('can view single panel in a repeated row inside snapshot', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Custom grid repeats - view single panel inside snapshot',
        JSON.stringify(testV2DashWithRowRepeats)
      );

      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 1')).hover();
      // open panel snapshot
      await page.keyboard.press('p+s');

      // click "Publish snapshot"
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareSnapshot.publishSnapshot)
        .click();

      // click "Copy link" button
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareSnapshot.copyUrlButton)
        .click();

      await goToPanelSnapshot(page);

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('single panel row 1'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(getTitleInRepeatRow(1, 1)))
      ).toBeHidden();
    });
  }
);
