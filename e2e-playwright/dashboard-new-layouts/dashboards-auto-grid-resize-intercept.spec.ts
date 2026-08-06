import { type Page } from '@playwright/test';

import { test, expect, type Components, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { Controls, Sidebar } from './page-objects';
import { importTestDashboard } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

test.use({
  viewport: { width: 1920, height: 1080 },
});

// mirrors interceptorTestId in AutoGridResizeIntercept.tsx
const RESIZE_ZONE_TESTID = 'auto-grid-resize-intercept';

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
      const { sidebar } = await setupAutoGridInEditMode(
        page,
        dashboardPage,
        selectors,
        components,
        'Auto grid resize intercept - switch'
      );

      const resizeZones = page.getByTestId(RESIZE_ZONE_TESTID);
      await expect(resizeZones.first()).toBeVisible();

      await dragResizeCorner(page);

      // The popover explains why the resize was blocked and offers the two ways out.
      // Portalled UI: anchored to the menu's own root, per the suite conventions.
      const interceptMenu = page.getByRole('menu');
      await expect(interceptMenu.getByText('Panel sizes are managed by auto layout')).toBeVisible();

      await interceptMenu.getByRole('menuitem', { name: 'Switch to custom' }).click();

      // Confirm the "resets panel positions and sizes" modal. This is the spec's permitted one-off
      // raw selector: the confirm is triggered by the popover menu, which has no page object.
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();

      await expect(sidebar.dashboardOptions.gridLayoutOptions.getLayoutType('Custom')).toBeChecked();
    });

    test('intercepts a resize gesture and can open the auto grid layout settings', async ({
      dashboardPage,
      selectors,
      page,
      components,
    }) => {
      const { sidebar } = await setupAutoGridInEditMode(
        page,
        dashboardPage,
        selectors,
        components,
        'Auto grid resize intercept - edit'
      );

      await sidebar.clickCloseButton();

      await dragResizeCorner(page);

      const interceptMenu = page.getByRole('menu');
      await expect(interceptMenu.getByText('Panel sizes are managed by auto layout')).toBeVisible();

      await interceptMenu.getByRole('menuitem', { name: 'Edit auto layout' }).click();

      await expect(sidebar.dashboardOptions.gridLayoutOptions.getLayoutType('Auto')).toBeVisible();
    });
  }
);

async function setupAutoGridInEditMode(
  page: Page,
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  components: Components,
  title: string
): Promise<{ sidebar: Sidebar }> {
  await importTestDashboard(page, selectors, title, undefined);

  const controls = new Controls({ page, dashboardPage, selectors, components });
  const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

  await controls.enterEditMode();

  await sidebar.toolbar.clickButton('Options');
  await sidebar.dashboardOptions.gridLayoutOptions.switchLayout('Auto', { confirm: true });

  return { sidebar };
}

// Drags the panel's bottom-right resize corner. Uses the raw mouse API (not locator.hover) because
// the zone is a tiny transparent overlay; this stays in the spec per the timing-sensitive-mechanics rule.
async function dragResizeCorner(page: Page) {
  const zone = page.getByTestId(RESIZE_ZONE_TESTID).first();
  const box = await zone.boundingBox();
  expect(box).not.toBeNull();

  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 40, centerY + 40, { steps: 10 });
  await page.mouse.up();
}
