import { test, expect, type Locator, type Page } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'gdev-view-panel-tests';
const PANEL_TITLE = 'Time series panel';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  openFeature: {
    flags: {
      'grafana.panelHoverActions': true,
    },
  },
});

// The popover opens once the pointer rests on the panel, which needs a few pointer moves rather than a single jump
async function restPointerOn(page: Page, target: Locator) {
  const box = await target.boundingBox();
  if (!box) {
    throw new Error('Hover target is not visible');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2 + 5, { steps: 5 });
}

test.describe('Panel hover actions', { tag: ['@dashboards'] }, () => {
  test('Hovering a panel shows its actions instead of the header menu', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_TITLE));

    await restPointerOn(page, panel);

    await expect(page.getByRole('button', { name: 'View panel' })).toBeVisible();
    await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menu(PANEL_TITLE))).toBeHidden();

    await page.getByRole('button', { name: 'More actions' }).click();
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Inspect'))
    ).toBeVisible();
  });

  test('Keyboard focus still reveals the header menu', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_TITLE));

    await panel.evaluate((element: HTMLElement) => element.focus({ focusVisible: true }));

    await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menu(PANEL_TITLE))).toBeVisible();
  });

  test('Maximizes a panel and goes back to the dashboard from the same place', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_TITLE));

    await restPointerOn(page, panel);
    await page.getByRole('button', { name: 'View panel' }).click();
    await expect(page).toHaveURL((url) => url.searchParams.has('viewPanel'));

    await restPointerOn(page, panel);
    // The view panel pane has a text "Back to dashboard" button too; the popover's is the labelled icon button
    await page.locator('button[aria-label="Back to dashboard"]').click();
    await expect(page).toHaveURL((url) => !url.searchParams.has('viewPanel'));
  });
});
