import { type Page } from '@playwright/test';

import { test, expect, type Components, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { Controls, Panel, Sidebar } from './page-objects';
import { importTestDashboard, switchToAutoGrid } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

test.use({
  viewport: { width: 1920, height: 1080 },
});

const RESIZE_ZONE_LABEL = 'Panel sizes are managed by auto layout';

test.describe(
  'Dashboard auto grid resize intercept',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('intercepts a resize gesture and can switch the panel to a custom grid', async ({
      dashboardPage,
      selectors,
      page,
      components,
    }) => {
      await setupAutoGridInEditMode(page, dashboardPage, selectors, components, 'Auto grid resize intercept - switch');

      const resizeZones = page.getByRole('button', { name: RESIZE_ZONE_LABEL });
      await expect(resizeZones.first()).toBeVisible();

      await dragResizeCorner(page);

      // The popover explains why the resize was blocked and offers the two ways out.
      await expect(page.getByText('Cannot resize in auto layout')).toBeVisible();

      await page.getByRole('menuitem', { name: 'Switch to custom' }).click();

      // Confirm the "resets panel positions and sizes" modal.
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();

      const customLayoutOption = page.getByLabel('layout-selection-option-Custom');
      expect(customLayoutOption).toBeChecked();
    });

    test('intercepts a resize gesture and can open the auto grid layout settings', async ({
      dashboardPage,
      selectors,
      page,
      components,
    }) => {
      await setupAutoGridInEditMode(page, dashboardPage, selectors, components, 'Auto grid resize intercept - edit');

      await dragResizeCorner(page);
      await expect(page.getByText('Cannot resize in auto layout')).toBeVisible();

      await page.getByRole('menuitem', { name: 'Edit auto layout' }).click();
      const autoLayoutOption = page.getByLabel('layout-selection-option-Auto');

      expect(autoLayoutOption).toBeVisible();
    });
  }
);

async function setupAutoGridInEditMode(
  page: Page,
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  components: Components,
  title: string
) {
  await importTestDashboard(page, selectors, title, undefined);

  const controls = new Controls({ page, dashboardPage, selectors, components });
  const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

  await controls.enterEditMode();

  await sidebar.toolbar.clickButton('Options');
  await switchToAutoGrid(page, dashboardPage);
}

// Drags the panel's bottom-right resize corner. Uses the raw mouse API (not locator.hover) because
// the zone is a tiny transparent overlay; this stays in the spec per the timing-sensitive-mechanics rule.
async function dragResizeCorner(page: Page) {
  const zone = page.getByRole('button', { name: RESIZE_ZONE_LABEL }).first();
  const box = await zone.boundingBox();
  expect(box).not.toBeNull();

  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 40, centerY + 40, { steps: 10 });
  await page.mouse.up();
}
