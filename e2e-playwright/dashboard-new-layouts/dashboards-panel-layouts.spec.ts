import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Panels, Sidebar } from './page-objects';
import { type GridLayoutOptions } from './page-objects/sidebar/shared/GridLayoutOptions';
import { getPanelBox, importTestDashboard } from './utils';

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

test.describe(
  'Dashboard Panel Layouts',
  {
    tag: ['@dashboards'],
  },
  () => {
    test.describe('Layout switching', () => {
      test('can switch to auto grid layout', async ({ dashboardPage, selectors, page, components }) => {
        await importTestDashboard(page, selectors, 'Switch to auto grid');

        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panels = new Panels({ page, dashboardPage, selectors, components });
        const gridLayoutOptions = sidebar.dashboardOptions.gridLayoutOptions;

        await controls.enterEditMode();

        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await sidebar.toolbar.clickButton('Options');

        await gridLayoutOptions.switchLayout('Auto', { confirm: true });

        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await checkAutoGridLayoutInputs(gridLayoutOptions);

        await controls.saveDashboard();
        await page.reload();

        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');

        await checkAutoGridLayoutInputs(gridLayoutOptions);
      });
    });

    test.describe('Auto grid column options', () => {
      test('can change min column width', async ({ dashboardPage, selectors, page, components }) => {
        await importTestDashboard(page, selectors, 'Set min column width');

        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panels = new Panels({ page, dashboardPage, selectors, components });
        const gridLayoutOptions = sidebar.dashboardOptions.gridLayoutOptions;

        await controls.enterEditMode();

        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await sidebar.toolbar.clickButton('Options');

        await gridLayoutOptions.switchLayout('Auto', { confirm: true });

        // At Standard width all 3 panels fit on one row at this viewport, so start from
        // Wide: only 2 columns fit, which forces the last panel onto a second row
        await gridLayoutOptions.selectMinColumnWidth('Wide');

        // Verify wide layout wraps panels onto two rows; poll: boundingBox() doesn't auto-wait for the re-layout
        await expect(async () => {
          // getPanelBox asserts non-null; the inline .last() measurement needs its own null check
          const firstPanelBox = await getPanelBox(panels, 'New panel');
          const lastPanelBox = await panels.getPanels('New panel').last().boundingBox();
          expect(lastPanelBox, 'Last panel should have a bounding box').not.toBeNull();

          expect(lastPanelBox!.y, 'Last panel should be on a row below the first').toBeGreaterThan(firstPanelBox.y);
        }).toPass();

        await gridLayoutOptions.selectMinColumnWidth('Narrow');

        // Verify narrow layout fits all panels on one row; poll until the re-layout lands
        await expect(async () => {
          const firstPanelBox = await getPanelBox(panels, 'New panel');
          const lastPanelBox = await panels.getPanels('New panel').last().boundingBox();
          expect(lastPanelBox, 'Last panel should have a bounding box').not.toBeNull();

          expect(lastPanelBox!.y, 'Last panel should be on the same row as the first').toBe(firstPanelBox.y);
        }).toPass();

        await controls.saveDashboard();
        await page.reload();

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');

        await expect(gridLayoutOptions.getMinColumnWidthSelect()).toHaveValue('Narrow');

        // Verify the narrow layout persisted: all panels on one row; poll while panels re-render after the reload
        await expect(async () => {
          const firstPanelBox = await getPanelBox(panels, 'New panel');
          const lastPanelBox = await panels.getPanels('New panel').last().boundingBox();
          expect(lastPanelBox, 'Last panel should have a bounding box').not.toBeNull();

          expect(lastPanelBox!.y, 'Last panel should be on the same row as the first').toBe(firstPanelBox.y);
        }).toPass();
      });

      test('can change to custom min column width', async ({ dashboardPage, selectors, page, components }) => {
        await importTestDashboard(page, selectors, 'Set custom min column width');

        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panels = new Panels({ page, dashboardPage, selectors, components });
        const gridLayoutOptions = sidebar.dashboardOptions.gridLayoutOptions;

        await controls.enterEditMode();

        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await sidebar.toolbar.clickButton('Options');

        await gridLayoutOptions.switchLayout('Auto', { confirm: true });

        await gridLayoutOptions.selectMinColumnWidth('Custom', 1100);

        // Changing to 1100 custom width should have each panel span the whole row (stacked vertically)
        await verifyPanelsStackedVertically(panels);

        await controls.saveDashboard();
        await page.reload();

        await verifyPanelsStackedVertically(panels);

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');

        await expect(gridLayoutOptions.getCustomMinColumnWidthInput()).toHaveValue('1100');

        await verifyPanelsStackedVertically(panels);

        await gridLayoutOptions.clickClearCustomMinColumnWidth();
        await expect(gridLayoutOptions.getMinColumnWidthSelect()).toHaveValue('Standard');
      });

      test('can change max columns', async ({ dashboardPage, selectors, page, components }) => {
        await importTestDashboard(page, selectors, 'Set max columns');

        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panels = new Panels({ page, dashboardPage, selectors, components });
        const gridLayoutOptions = sidebar.dashboardOptions.gridLayoutOptions;

        await controls.enterEditMode();

        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await sidebar.toolbar.clickButton('Options');

        await gridLayoutOptions.switchLayout('Auto', { confirm: true });

        await gridLayoutOptions.selectMaxColumns('1');

        // Changing to 1 max column should have each panel span the whole row (stacked vertically)
        await verifyPanelsStackedVertically(panels);

        await controls.saveDashboard();
        await page.reload();

        await verifyPanelsStackedVertically(panels);

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');

        await expect(gridLayoutOptions.getMaxColumnsSelect()).toHaveValue('1');

        await verifyPanelsStackedVertically(panels);
      });
    });

    test.describe('Auto grid row options', () => {
      test('can change row height', async ({ dashboardPage, selectors, page, components }) => {
        await importTestDashboard(page, selectors, 'Set row height');

        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panels = new Panels({ page, dashboardPage, selectors, components });
        const gridLayoutOptions = sidebar.dashboardOptions.gridLayoutOptions;

        await controls.enterEditMode();

        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await sidebar.toolbar.clickButton('Options');

        await gridLayoutOptions.switchLayout('Auto', { confirm: true });

        const regularRowHeight = (await getPanelBox(panels, 'New panel')).height;

        await gridLayoutOptions.selectRowHeight('Short');

        // boundingBox() doesn't auto-wait, so poll the height until the re-layout applies
        await expect
          .poll(async () => (await getPanelBox(panels, 'New panel')).height, {
            message: 'Panel should shrink to the Short row height',
          })
          .toBeLessThan(regularRowHeight);

        await gridLayoutOptions.selectRowHeight('Tall');

        await expect
          .poll(async () => (await getPanelBox(panels, 'New panel')).height, {
            message: 'Panel should grow to the Tall row height',
          })
          .toBeGreaterThan(regularRowHeight);

        await controls.saveDashboard();
        await page.reload();

        await expect
          .poll(async () => (await getPanelBox(panels, 'New panel')).height, {
            message: 'Tall row height should persist after the reload',
          })
          .toBeGreaterThan(regularRowHeight);

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');

        await expect(gridLayoutOptions.getRowHeightSelect()).toHaveValue('Tall');

        // The edit pane shrinks the canvas and re-flows the grid
        await expect
          .poll(async () => (await getPanelBox(panels, 'New panel')).height, {
            message: 'Panel should keep the Tall row height in edit mode',
          })
          .toBeGreaterThan(regularRowHeight);
      });

      test('can change to custom row height', async ({ dashboardPage, selectors, page, components }) => {
        await importTestDashboard(page, selectors, 'Set custom row height');

        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panels = new Panels({ page, dashboardPage, selectors, components });
        const gridLayoutOptions = sidebar.dashboardOptions.gridLayoutOptions;

        await controls.enterEditMode();

        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await sidebar.toolbar.clickButton('Options');

        await gridLayoutOptions.switchLayout('Auto', { confirm: true });

        const regularRowHeight = (await getPanelBox(panels, 'New panel')).height;

        await gridLayoutOptions.selectRowHeight('Custom', 800);

        // boundingBox() doesn't auto-wait; poll until the new row height applies
        await expect(async () => {
          const customHeight = (await getPanelBox(panels, 'New panel')).height;
          expect(customHeight).toBeCloseTo(800, 5); // Allow some tolerance for rendering differences
          expect(customHeight).toBeGreaterThan(regularRowHeight);
        }).toPass();

        await controls.saveDashboard();
        await page.reload();

        await expect
          .poll(async () => (await getPanelBox(panels, 'New panel')).height, {
            message: 'Custom row height should persist after the reload',
          })
          .toBeCloseTo(800, 5);

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');

        await expect(gridLayoutOptions.getCustomRowHeightInput()).toHaveValue('800');

        await gridLayoutOptions.clickClearCustomRowHeight();
        await expect(gridLayoutOptions.getRowHeightSelect()).toHaveValue('Standard');
      });

      test('can change fill screen', async ({ dashboardPage, selectors, page, components }) => {
        await importTestDashboard(page, selectors, 'Set fill screen');

        const controls = new Controls({ page, dashboardPage, selectors, components });
        const sidebar = new Sidebar({ page, dashboardPage, selectors, components });
        const panels = new Panels({ page, dashboardPage, selectors, components });
        const gridLayoutOptions = sidebar.dashboardOptions.gridLayoutOptions;

        await controls.enterEditMode();

        await expect(panels.getPanels('New panel')).toHaveCount(3);

        await sidebar.toolbar.clickButton('Options');

        await gridLayoutOptions.switchLayout('Auto', { confirm: true });

        // Set narrow column width first to ensure panels fit horizontally
        await gridLayoutOptions.selectMinColumnWidth('Narrow');

        const initialHeight = (await getPanelBox(panels, 'New panel')).height;

        await gridLayoutOptions.toggleFillScreen();

        // boundingBox() doesn't auto-wait, so poll the height until the re-layout applies
        await expect
          .poll(async () => (await getPanelBox(panels, 'New panel')).height, {
            message: 'Fill screen should increase the panel height',
          })
          .toBeGreaterThan(initialHeight);

        await controls.saveDashboard();
        await page.reload();

        await expect
          .poll(async () => (await getPanelBox(panels, 'New panel')).height, {
            message: 'Fill screen height should persist after the reload',
          })
          .toBeGreaterThan(initialHeight);

        await controls.enterEditMode();
        await sidebar.toolbar.clickButton('Options');

        await expect(gridLayoutOptions.getFillScreenSwitch()).toBeChecked();

        // The edit pane shrinks the canvas and re-flows the grid
        await expect
          .poll(async () => (await getPanelBox(panels, 'New panel')).height, {
            message: 'Fill screen height should persist in edit mode',
          })
          .toBeGreaterThan(initialHeight);
      });
    });
  }
);

// Helper functions
async function checkAutoGridLayoutInputs(gridLayoutOptions: GridLayoutOptions) {
  await test.step('Check all auto grid sizing inputs are visible', async () => {
    await expect(gridLayoutOptions.getMinColumnWidthSelect()).toBeVisible();
    await expect(gridLayoutOptions.getMaxColumnsSelect()).toBeVisible();
    await expect(gridLayoutOptions.getRowHeightSelect()).toBeVisible();
    await expect(gridLayoutOptions.getFillScreenSwitch()).toBeVisible();
  });
}

async function verifyPanelsStackedVertically(panels: Panels, expectedCount = 3) {
  await test.step('Verify panels are stacked vertically, one full-width panel per row', async () => {
    // .all() does not wait: make sure every panel is rendered before measuring
    await expect(panels.getPanels('New panel')).toHaveCount(expectedCount);

    const allPanels = await panels.getPanels('New panel').all();
    expect(allPanels).toHaveLength(expectedCount);

    // boundingBox() doesn't auto-wait; poll until the stacked layout settles
    await expect(async () => {
      let previousBox: { x: number; y: number; width: number; height: number } | null = null;

      for (const [i, panel] of allPanels.entries()) {
        const box = await panel.boundingBox();
        expect(box, `Panel ${i} should have a bounding box`).not.toBeNull();

        if (previousBox) {
          expect(box!.y, `Panel ${i} should be below panel ${i - 1}`).toBeGreaterThan(previousBox.y);
          // one panel per row: all panels share the same left edge and width
          expect(box!.x, `Panel ${i} should be left-aligned with panel ${i - 1}`).toBe(previousBox.x);
          expect(box!.width, `Panel ${i} should have the same width as panel ${i - 1}`).toBe(previousBox.width);
        }

        previousBox = box!;
      }
    }).toPass();
  });
}
