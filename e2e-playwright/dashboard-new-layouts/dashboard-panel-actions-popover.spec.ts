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

  test.describe('on a touch screen', () => {
    test.use({ hasTouch: true });

    test('tapping the panel header opens the popover, and More actions opens the panel menu', async ({
      gotoDashboardPage,
      panels,
      page,
    }) => {
      await gotoDashboardPage({ uid: DASHBOARD_UID });

      const header = panels.getHeader(PANEL_TITLE);
      const box = await header.boundingBox();
      // The empty part of the header, next to the title
      await header.tap({ position: { x: (box?.width ?? 0) - 40, y: (box?.height ?? 0) / 2 } });

      const popover = panels.getActionsPopover();
      await expect(popover.getByRole('button', { name: 'Expand (v)' })).toBeVisible();

      await popover.getByRole('button', { name: 'More actions' }).tap();
      await expect(page.getByRole('menu').getByRole('menuitem', { name: 'Inspect' })).toBeVisible();
    });
  });

  test.describe('on a panel without a title', () => {
    let dashboardUID: string;

    test.beforeAll(async ({ request }) => {
      const response = await request.post('/api/dashboards/db', {
        data: {
          dashboard: {
            title: 'Panel actions popover untitled panel',
            panels: [
              {
                id: 1,
                title: '',
                type: 'timeseries',
                gridPos: { x: 0, y: 4, w: 12, h: 8 },
                links: [
                  { title: 'Runbook', url: '/dashboards?panel-link=runbook' },
                  { title: 'Docs', url: '/dashboards?panel-link=docs' },
                ],
              },
            ],
          },
          overwrite: true,
        },
      });
      dashboardUID = (await response.json()).uid;
    });

    test.afterAll(async ({ request }) => {
      if (dashboardUID) {
        await request.delete(`/api/dashboards/uid/${dashboardUID}`);
      }
    });

    test('the panel links menu in the popover opens a link', async ({ gotoDashboardPage, panels, page }) => {
      await gotoDashboardPage({ uid: dashboardUID });

      await panels.openActionsPopover('');
      await panels.getActionsPopover().getByRole('button', { name: 'Panel links' }).click();
      await page.getByRole('menu').getByRole('menuitem', { name: 'Runbook' }).click();

      await expect(page).toHaveURL((url) => url.searchParams.get('panel-link') === 'runbook');
    });
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
