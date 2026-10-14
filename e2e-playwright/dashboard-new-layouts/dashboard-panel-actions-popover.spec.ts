import { test, expect } from './fixtures';

const DASHBOARD_UID = 'gdev-view-panel-tests';
const PANEL_TITLE = 'Time series panel';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  openFeature: {
    flags: {
      'grafana.panelActionsPopover': true,
      'grafana.viewPanelPane': true,
    },
  },
});

test.describe('Panel actions popover', { tag: ['@dashboards'] }, () => {
  test('in view mode, offers Expand, Edit, Explore and More actions', async ({ gotoDashboardPage, panels }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID });

    await panels.openActionsPopover(PANEL_TITLE);

    const popover = panels.getActionsPopover();
    await expect(popover.getByRole('button', { name: 'Expand (v)' })).toBeVisible();
    await expect(popover.getByRole('button', { name: 'Edit (e)' })).toBeVisible();
    await expect(popover.getByRole('button', { name: 'Explore (p x)' })).toBeVisible();
    await expect(popover.getByRole('button', { name: 'More actions' })).toBeVisible();
    await expect(popover.getByRole('button', { name: 'Settings' })).toHaveCount(0);
  });

  test('More actions opens the panel menu without the actions in the popover', async ({
    gotoDashboardPage,
    panels,
    page,
  }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID });

    await panels.openActionsPopover(PANEL_TITLE);
    await panels.getActionsPopover().getByRole('button', { name: 'More actions' }).click();

    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Inspect' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'View' })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: 'Explore' })).toHaveCount(0);
  });

  test('Expand views the panel and Restore size returns to the dashboard', async ({
    gotoDashboardPage,
    panels,
    page,
    selectors,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    await panels.openActionsPopover(PANEL_TITLE);
    await panels.getActionsPopover().getByRole('button', { name: 'Expand (v)' }).click();

    await expect(page).toHaveURL((url) => url.searchParams.has('viewPanel'));
    await expect(dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.headerTitle)).toContainText(
      'View panel'
    );
    await expect(dashboardPage.getByGrafanaSelector(selectors.components.ViewPanelSidePane.goBackButton)).toHaveCount(
      0
    );

    await panels.openActionsPopover(PANEL_TITLE);
    await panels.getActionsPopover().getByRole('button', { name: 'Restore size (v)' }).click();

    await expect(page).toHaveURL((url) => !url.searchParams.has('viewPanel'));
  });

  test('in edit mode, offers Settings, Copy, Duplicate and Remove', async ({
    gotoDashboardPage,
    controls,
    panels,
    sidebar,
  }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID });
    await controls.enterEditMode();

    await panels.openActionsPopover(PANEL_TITLE);

    const popover = panels.getActionsPopover();
    await expect(popover.getByRole('button', { name: 'Copy to clipboard' })).toBeVisible();
    await expect(popover.getByRole('button', { name: 'Duplicate' })).toBeVisible();
    await expect(popover.getByRole('button', { name: 'Remove (p r)' })).toBeVisible();
    await expect(popover.getByRole('button', { name: 'Explore (p x)' })).toHaveCount(0);

    await popover.getByRole('button', { name: 'Settings' }).click();

    await expect(sidebar.panelOptions.getTitleInput()).toHaveValue(PANEL_TITLE);
  });
});
