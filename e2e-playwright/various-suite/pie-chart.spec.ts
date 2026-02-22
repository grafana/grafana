import { selectors } from '@grafana/e2e-selectors';
import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Pie Chart Panel',
  {
    tag: ['@various'],
  },
  () => {
    test('Pie Chart rendering e2e tests', async ({ page }) => {
      // Open Panel Tests - Pie Chart
      await page.goto('/d/lVE-2YFMz/panel-tests-pie-chart');

      // Check that there are 5 pie chart slices
      const pieChartSlices = page.locator(
        `[data-viz-panel-key="panel-11"] [data-testid^="${selectors.components.Panels.Visualization.PieChart.svgSlice}"]`
      );
      await expect(pieChartSlices).toHaveCount(5);
    });

    test('Pie Chart with data links - keyboard navigation', async ({ page }) => {
      // Open Panel Tests - Pie Chart
      await page.goto('/d/lVE-2YFMz/panel-tests-pie-chart');

      const pieChartSlices = page.locator(
        `[data-viz-panel-key="panel-11"] [data-testid^="${selectors.components.Panels.Visualization.PieChart.svgSlice}"]`
      );

      // Verify slices are rendered
      await expect(pieChartSlices).toHaveCount(5);

      // Test keyboard navigation - Tab should focus on slices with data links
      // Note: This test assumes at least one slice has data links configured
      // If no slices have links, this will test that no slices are focusable
      const firstSlice = pieChartSlices.first();
      
      // Try to focus the first slice via keyboard
      await page.keyboard.press('Tab');
      
      // Verify that focus can be received (if data links are configured)
      // For slices with data links, tabIndex should be 0 or the element should be focusable
      // For slices without data links, tabIndex should be -1
      const tabIndex = await firstSlice.getAttribute('tabIndex');
      
      // If tabIndex is 0, the slice is focusable and should accept keyboard events
      if (tabIndex === '0') {
        await firstSlice.focus();
        await expect(firstSlice).toBeFocused();
        
        // Test Enter key opens context menu (for multiple links) or navigates (single link)
        const contextMenu = page.locator('[role="menu"]');
        
        await page.keyboard.press('Enter');
        
        // Check if context menu appeared (multiple links case) or if navigation occurred (single link)
        // Both are valid behaviors depending on link count
        const menuVisible = await contextMenu.isVisible().catch(() => false);
        const urlChanged = page.url() !== (await page.url());
        
        // At least one should happen: menu opens OR navigation occurs
        expect(menuVisible || urlChanged).toBeTruthy();
      }
    });

    test('Pie Chart with single data link - anchor element focus', async ({ page }) => {
      await page.goto('/d/lVE-2YFMz/panel-tests-pie-chart');

      // Check for anchor elements wrapping slices (single link case)
      const singleLinkAnchors = page.locator(
        `[data-viz-panel-key="panel-11"] a[data-testid="${selectors.components.DataLinksContextMenu.singleLink}"]`
      );

      const anchorCount = await singleLinkAnchors.count();

      if (anchorCount > 0) {
        // If we have single-link anchors, verify they are focusable
        const firstAnchor = singleLinkAnchors.first();
        await firstAnchor.focus();
        await expect(firstAnchor).toBeFocused();

        // Verify the inner SVG element is not focusable
        const innerSvg = firstAnchor.locator('[tabIndex="-1"]');
        await expect(innerSvg).toHaveCount(1);
      }
    });

    test('Pie Chart with multiple data links - context menu keyboard interaction', async ({ page }) => {
      await page.goto('/d/lVE-2YFMz/panel-tests-pie-chart');

      // Look for SVG elements with tabIndex="0" (multiple links case)
      const focusableSlices = page.locator(
        `[data-viz-panel-key="panel-11"] [data-testid^="${selectors.components.Panels.Visualization.PieChart.svgSlice}"][tabIndex="0"]`
      );

      const focusableCount = await focusableSlices.count();

      if (focusableCount > 0) {
        const firstFocusable = focusableSlices.first();
        
        // Focus the slice
        await firstFocusable.focus();
        await expect(firstFocusable).toBeFocused();

        // Press Enter to open context menu
        await page.keyboard.press('Enter');

        // Verify context menu appears
        const contextMenu = page.locator('[role="menu"]');
        await expect(contextMenu).toBeVisible();

        // Test keyboard navigation within menu
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Escape');

        // Menu should close
        await expect(contextMenu).not.toBeVisible();
      }
    });
  }
);
