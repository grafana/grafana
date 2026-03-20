import { test, expect } from '@grafana/plugin-e2e';
import { type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * E2E tests for real-time dashboard collaboration.
 *
 * Uses two browser contexts to simulate two concurrent users (User A and User B)
 * editing the same dashboard. Requires the `dashboardCollaboration` feature toggle.
 */

test.use({
  featureToggles: {
    dashboardCollaboration: true,
    kubernetesDashboards: true,
  },
});

test.describe(
  'Dashboard Collaboration',
  {
    tag: ['@dashboards', '@collab'],
  },
  () => {
    let dashboardUID: string;

    test.beforeAll(async ({ request }) => {
      // Create a test dashboard with collaboration enabled via API.
      const response = await request.post('/api/dashboards/db', {
        data: {
          dashboard: {
            title: 'Collab E2E Test Dashboard',
            tags: ['collab-e2e'],
            panels: [
              {
                id: 1,
                type: 'text',
                title: 'Panel A',
                gridPos: { h: 8, w: 12, x: 0, y: 0 },
                options: { content: 'Hello from Panel A', mode: 'markdown' },
              },
              {
                id: 2,
                type: 'text',
                title: 'Panel B',
                gridPos: { h: 8, w: 12, x: 12, y: 0 },
                options: { content: 'Hello from Panel B', mode: 'markdown' },
              },
            ],
          },
          overwrite: true,
        },
      });
      const body = await response.json();
      dashboardUID = body.uid;
      expect(dashboardUID).toBeTruthy();

      // Enable collaboration annotation on the dashboard.
      // This is done by patching the k8s resource annotations.
      await request.patch(`/api/dashboards/uid/${dashboardUID}`, {
        data: {
          dashboard: {
            ...(await request.get(`/api/dashboards/uid/${dashboardUID}`).then((r) => r.json()))
              .dashboard,
          },
          overwrite: true,
        },
      });
    });

    test.afterAll(async ({ request }) => {
      if (dashboardUID) {
        await request.delete(`/api/dashboards/uid/${dashboardUID}`);
      }
    });

    test('Basic collaboration: User A edits panel title, User B sees it', async ({
      page,
      browser,
    }) => {
      // User A opens the dashboard in edit mode.
      const userA = page;
      await userA.goto(`/d/${dashboardUID}?editview=true`);
      await userA.waitForSelector('[data-testid="dashboard-scene"]', { timeout: 10_000 });

      // User B opens the same dashboard in a new context.
      const contextB = await browser.newContext({
        httpCredentials: { username: 'admin', password: 'admin' },
      });
      const userB = await contextB.newPage();
      await userB.goto(`/d/${dashboardUID}?editview=true`);
      await userB.waitForSelector('[data-testid="dashboard-scene"]', { timeout: 10_000 });

      // Verify both users see the collab presence bar.
      await expect(userA.locator('[data-testid="collab-presence-bar"]')).toBeVisible({
        timeout: 5_000,
      });
      await expect(userB.locator('[data-testid="collab-presence-bar"]')).toBeVisible({
        timeout: 5_000,
      });

      // User A edits Panel A title.
      const panelA = userA.locator('[data-testid="panel-1"]');
      await panelA.dblclick();
      const titleInput = userA.locator('[data-testid="panel-title-input"]');
      await titleInput.fill('Panel A - Edited by User A');
      await titleInput.press('Enter');

      // User B should see the updated title within a few seconds.
      await expect(userB.locator('text=Panel A - Edited by User A')).toBeVisible({
        timeout: 10_000,
      });

      await contextB.close();
    });

    test('Lock contention: User A locks panel, User B sees lock indicator', async ({
      page,
      browser,
    }) => {
      const userA = page;
      await userA.goto(`/d/${dashboardUID}?editview=true`);
      await userA.waitForSelector('[data-testid="dashboard-scene"]', { timeout: 10_000 });

      const contextB = await browser.newContext({
        httpCredentials: { username: 'admin', password: 'admin' },
      });
      const userB = await contextB.newPage();
      await userB.goto(`/d/${dashboardUID}?editview=true`);
      await userB.waitForSelector('[data-testid="dashboard-scene"]', { timeout: 10_000 });

      // User A clicks on Panel A to acquire lock.
      await userA.locator('[data-testid="panel-1"]').click();

      // User B should see a lock indicator on Panel A.
      await expect(userB.locator('[data-testid="panel-1"] [data-testid="collab-lock-badge"]')).toBeVisible({
        timeout: 10_000,
      });

      // User A clicks away (releases lock).
      await userA.locator('body').click({ position: { x: 0, y: 0 } });

      // Lock indicator should disappear on User B's view.
      await expect(userB.locator('[data-testid="panel-1"] [data-testid="collab-lock-badge"]')).not.toBeVisible({
        timeout: 10_000,
      });

      await contextB.close();
    });

    test('Cursor visibility: User A mouse movement visible to User B', async ({
      page,
      browser,
    }) => {
      const userA = page;
      await userA.goto(`/d/${dashboardUID}?editview=true`);
      await userA.waitForSelector('[data-testid="dashboard-scene"]', { timeout: 10_000 });

      const contextB = await browser.newContext({
        httpCredentials: { username: 'admin', password: 'admin' },
      });
      const userB = await contextB.newPage();
      await userB.goto(`/d/${dashboardUID}?editview=true`);
      await userB.waitForSelector('[data-testid="dashboard-scene"]', { timeout: 10_000 });

      // Wait for collab connection.
      await expect(userA.locator('[data-testid="collab-presence-bar"]')).toBeVisible({
        timeout: 5_000,
      });

      // User A moves mouse across the dashboard.
      await userA.mouse.move(400, 300);
      await userA.waitForTimeout(200);
      await userA.mouse.move(500, 400);

      // User B should see a cursor overlay element for User A.
      await expect(userB.locator('[data-testid="collab-cursor-overlay"] svg')).toBeVisible({
        timeout: 10_000,
      });

      await contextB.close();
    });

    test('Autosave: edits create auto version after quiescence', async ({ page, request }) => {
      await page.goto(`/d/${dashboardUID}?editview=true`);
      await page.waitForSelector('[data-testid="dashboard-scene"]', { timeout: 10_000 });

      // Make an edit to trigger autosave.
      const panel = page.locator('[data-testid="panel-1"]');
      await panel.dblclick();
      const titleInput = page.locator('[data-testid="panel-title-input"]');
      await titleInput.fill('Autosave Test Title');
      await titleInput.press('Enter');

      // Wait for autosave quiescence (default 3s) + save cycle (1s) + buffer.
      await page.waitForTimeout(6_000);

      // Check the save status indicator shows "Saved".
      await expect(page.locator('[data-testid="collab-save-status"]')).toContainText('Saved', {
        timeout: 10_000,
      });

      // Verify via API that an auto version was created.
      const versionsResponse = await request.get(
        `/api/dashboards/uid/${dashboardUID}/versions?limit=5`
      );
      const versions = await versionsResponse.json();
      const autoVersion = versions.versions?.find(
        (v: { versionType: string }) => v.versionType === 'auto'
      );
      expect(autoVersion).toBeTruthy();
    });

    test('Manual checkpoint: Cmd+S creates named version', async ({ page, request }) => {
      await page.goto(`/d/${dashboardUID}?editview=true`);
      await page.waitForSelector('[data-testid="dashboard-scene"]', { timeout: 10_000 });

      // Trigger Cmd+S (or Ctrl+S on non-Mac).
      const isMac = process.platform === 'darwin';
      await page.keyboard.press(isMac ? 'Meta+s' : 'Control+s');

      // The checkpoint drawer should appear.
      await expect(page.locator('[data-testid="collab-checkpoint-drawer"]')).toBeVisible({
        timeout: 5_000,
      });

      // Enter a version name and save.
      const nameInput = page.locator('[data-testid="checkpoint-message-input"]');
      await nameInput.fill('Added latency panel');
      await page.locator('[data-testid="checkpoint-save-button"]').click();

      // Drawer should close.
      await expect(page.locator('[data-testid="collab-checkpoint-drawer"]')).not.toBeVisible({
        timeout: 5_000,
      });

      // Wait for save to complete.
      await page.waitForTimeout(3_000);

      // Verify via API that a manual version was created with the message.
      const versionsResponse = await request.get(
        `/api/dashboards/uid/${dashboardUID}/versions?limit=5`
      );
      const versions = await versionsResponse.json();
      const manualVersion = versions.versions?.find(
        (v: { versionType: string; message: string }) =>
          v.versionType === 'manual' && v.message === 'Added latency panel'
      );
      expect(manualVersion).toBeTruthy();
    });

    test('Disconnect recovery: reconnects after WebSocket interruption', async ({ page }) => {
      await page.goto(`/d/${dashboardUID}?editview=true`);
      await page.waitForSelector('[data-testid="dashboard-scene"]', { timeout: 10_000 });

      // Wait for collab connection.
      await expect(page.locator('[data-testid="collab-save-status"]')).toContainText('Saved', {
        timeout: 10_000,
      });

      // Simulate WebSocket disconnect by going offline.
      await page.context().setOffline(true);

      // Status should show "Save failed" after connection loss.
      await expect(page.locator('[data-testid="collab-save-status"]')).toContainText(
        'Save failed',
        { timeout: 10_000 }
      );

      // Restore connection.
      await page.context().setOffline(false);

      // Status should recover to "Saved" after reconnection.
      await expect(page.locator('[data-testid="collab-save-status"]')).toContainText('Saved', {
        timeout: 15_000,
      });
    });
  }
);
