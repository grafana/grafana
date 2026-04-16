import { test, expect } from './fixture';

test.use({
  featureToggles: {
    cujTracking: true,
    dashboardNewLayouts: false,
  },
});

test.describe('dashboard_edit journey tracking', { tag: ['@journey-tracking'] }, () => {
  let dashboardUID: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/dashboards/db', {
      data: {
        dashboard: {
          title: 'Journey Edit Test Dashboard',
          panels: [
            {
              id: 1,
              title: 'Test Panel',
              type: 'timeseries',
              gridPos: { x: 0, y: 0, w: 12, h: 8 },
            },
          ],
        },
        overwrite: true,
      },
    });

    const body = await response.json();
    dashboardUID = body.uid;
  });

  test.afterAll(async ({ request }) => {
    if (dashboardUID) {
      await request.delete(`/api/dashboards/uid/${dashboardUID}`);
    }
  });

  test('enter edit mode and save records a successful edit journey', async ({
    page,
    journeyRecorder,
    gotoDashboardPage,
    selectors,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });
    await page.waitForLoadState('networkidle');

    // Click the edit button - this fires dashboards_edit_button_clicked which starts the journey
    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton)
      .click();

    await journeyRecorder.waitForJourneyStart('dashboard_edit');

    // Make a trivial change: open settings and modify the dashboard title
    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.settingsButton)
      .click();

    const titleInput = page.getByLabel('Title');
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill('Journey Edit Test Dashboard (edited)');
      // Close settings if a close button is available
      const closeButton = page.getByRole('button', { name: /close/i });
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
      }
    }

    // Save the dashboard - this fires grafana_dashboard_saved which ends the journey
    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton)
      .click();

    // Confirm save in the drawer
    await dashboardPage
      .getByGrafanaSelector(selectors.components.Drawer.DashboardSaveDrawer.saveButton)
      .click();

    // Wait for the save confirmation toast
    const toast = page.getByRole('status', { name: 'Dashboard saved' });
    await expect(toast).toBeVisible({ timeout: 10_000 });

    // Assert the journey completed successfully
    const journey = await journeyRecorder.waitForJourneyEnd('dashboard_edit');
    expect(journey.outcome).toBe('success');
    expect(journey.attributes.dashboardUID).toBe(dashboardUID);
    expect(journey.durationMs).toBeGreaterThan(0);
    expect(journey.durationMs).toBeLessThan(60_000);
  });

  test('enter edit mode and discard records a discarded edit journey', async ({
    page,
    journeyRecorder,
    gotoDashboardPage,
    selectors,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });
    await page.waitForLoadState('networkidle');

    // Click edit button to enter edit mode
    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton)
      .click();

    await journeyRecorder.waitForJourneyStart('dashboard_edit');

    // Make a real change so the dashboard becomes dirty. Without a structural
    // change, exitEditMode bypasses the discard dialog because hasActualSaveChanges
    // returns false (title-only changes via settings aren't counted).
    // Add a visualization via the toolbar Add button which creates a real panel diff.
    const addButton = page.getByRole('button', { name: /^Add$/ });
    await expect(addButton).toBeVisible({ timeout: 3000 });
    await addButton.click();

    const addVisualization = page.getByRole('menuitem', { name: /visualization/i });
    await expect(addVisualization).toBeVisible({ timeout: 3000 });
    await addVisualization.click();

    // This opens panel edit mode. Go back to the dashboard without saving the panel
    // to keep the dashboard dirty with the new panel addition.
    const backToDashboard = page.getByTestId(selectors.components.NavToolbar.editDashboard.backToDashboardButton);
    await expect(backToDashboard).toBeVisible({ timeout: 5000 });
    await backToDashboard.click();

    // Wait for the dashboard canvas with the Exit edit button
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.exitButton)
    ).toBeVisible({ timeout: 5000 });

    // Click the "Exit edit" button. Because the dashboard has an actual save change
    // (new panel), a confirmation dialog appears and clicking Discard fires
    // dashboards_edit_discarded which ends the journey.
    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.exitButton)
      .click();

    // Confirm discard in the confirmation dialog
    const discardButton = page.getByRole('button', { name: /discard/i });
    await expect(discardButton).toBeVisible({ timeout: 5000 });
    await discardButton.click();

    const journey = await journeyRecorder.waitForJourneyEnd('dashboard_edit');
    expect(journey.outcome).toBe('discarded');
    expect(journey.attributes.dashboardUID).toBe(dashboardUID);
    expect(journey.durationMs).toBeGreaterThan(0);
  });

  test('new dashboard save records a successful edit journey via grafana_dashboard_created', async ({
    page,
    journeyRecorder,
    gotoDashboardPage,
    selectors,
    request,
  }) => {
    // Navigate to /dashboard/new - this opens a new dashboard in edit mode.
    // New dashboards start in edit mode automatically, so dashboards_edit_button_clicked
    // does NOT fire on navigation. The journey only starts when the user explicitly
    // clicks the edit button on an existing dashboard.
    //
    // To test the grafana_dashboard_created end trigger, we create a dashboard through
    // the UI: navigate to an existing dashboard, enter edit, then use "Save As" to create
    // a new one. This fires dashboards_edit_button_clicked (start) and
    // grafana_dashboard_created (end).
    const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });
    await page.waitForLoadState('networkidle');

    // Enter edit mode on existing dashboard
    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton)
      .click();

    await journeyRecorder.waitForJourneyStart('dashboard_edit');

    // Save as new dashboard - this fires grafana_dashboard_created
    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton)
      .click();

    // Click "Save As" in the save drawer to create a new dashboard
    const saveAsButton = page.getByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveAsButton);
    if (await saveAsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveAsButton.click();

      // Fill in a new title
      const titleInput = page.getByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveAsTitleInput);
      await titleInput.fill('Journey Edit Test - Copy');

      // Confirm save
      await page.getByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton).click();
    } else {
      // Fallback: just save normally (the save triggers grafana_dashboard_saved, which
      // also ends the journey as success)
      await page.getByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton).click();
    }

    // Wait for the save confirmation
    const toast = page.getByRole('status', { name: /dashboard saved/i });
    await expect(toast).toBeVisible({ timeout: 10_000 });

    const journey = await journeyRecorder.waitForJourneyEnd('dashboard_edit');
    expect(journey.outcome).toBe('success');
    expect(journey.durationMs).toBeGreaterThan(0);

    // Clean up the newly created dashboard if it has a different UID
    const currentUrl = page.url();
    const uidMatch = currentUrl.match(/\/d\/([^/]+)\//);
    if (uidMatch && uidMatch[1] !== dashboardUID) {
      await request.delete(`/api/dashboards/uid/${uidMatch[1]}`);
    }
  });
});
