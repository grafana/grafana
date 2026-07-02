import { test, expect } from './fixture';

test.use({
  featureToggles: {
    cujTracking: true,
    dashboardNewLayouts: false,
  },
});

// Run tests serially so they share a single beforeAll/afterAll and avoid
// duplicate folder names across parallel workers.
test.describe.configure({ mode: 'serial' });

test.describe('browse_to_resource journey tracking', { tag: ['@journey-tracking'] }, () => {
  // Test data created via API for folder navigation tests.
  // Use a unique suffix so parallel CI shards or leftover data never collide.
  const suffix = Date.now().toString(36);
  const folderATitle = `Journey Folder A ${suffix}`;
  const folderBTitle = `Journey Folder B ${suffix}`;
  const dashInATitle = `Journey Dash In A ${suffix}`;
  const dashInBTitle = `Journey Dash In B ${suffix}`;

  let folderAUID: string;
  let folderBUID: string;
  let nestedDashboardUID: string;
  let deepNestedDashboardUID: string;

  test.beforeAll(async ({ request }) => {
    // Create folder A at root level
    const folderAResponse = await request.post('/api/folders', {
      data: { title: folderATitle },
    });
    const folderABody = await folderAResponse.json();
    folderAUID = folderABody.uid;

    // Create folder B nested inside folder A
    const folderBResponse = await request.post('/api/folders', {
      data: { title: folderBTitle, parentUid: folderAUID },
    });
    const folderBBody = await folderBResponse.json();
    folderBUID = folderBBody.uid;

    // Create a dashboard inside folder A (for single folder navigation test)
    const nestedDashResponse = await request.post('/api/dashboards/db', {
      data: {
        dashboard: {
          title: dashInATitle,
          panels: [
            {
              id: 1,
              type: 'text',
              title: 'Test',
              gridPos: { h: 4, w: 12, x: 0, y: 0 },
              options: { content: 'Journey test', mode: 'markdown' },
            },
          ],
          schemaVersion: 38,
          uid: '',
        },
        folderUid: folderAUID,
        overwrite: false,
      },
    });
    const nestedDashBody = await nestedDashResponse.json();
    nestedDashboardUID = nestedDashBody.uid;

    // Create a dashboard inside folder B (for deep nested navigation test)
    const deepDashResponse = await request.post('/api/dashboards/db', {
      data: {
        dashboard: {
          title: dashInBTitle,
          panels: [
            {
              id: 1,
              type: 'text',
              title: 'Test',
              gridPos: { h: 4, w: 12, x: 0, y: 0 },
              options: { content: 'Deep nested journey test', mode: 'markdown' },
            },
          ],
          schemaVersion: 38,
          uid: '',
        },
        folderUid: folderBUID,
        overwrite: false,
      },
    });
    const deepDashBody = await deepDashResponse.json();
    deepNestedDashboardUID = deepDashBody.uid;
  });

  test.afterAll(async ({ request }) => {
    // Delete parent folder with forceDeleteRules - this cascades to children
    if (folderAUID) {
      await request.delete(`/api/folders/${folderAUID}`, {
        params: { forceDeleteRules: true },
      });
    }
  });

  test('direct browse to dashboard records a successful journey', async ({ page, journeyRecorder, selectors }) => {
    // Navigate to the browse dashboards page - this fires grafana_browse_dashboards_page_view
    // which starts the browse_to_resource journey
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    await journeyRecorder.waitForJourneyStart('browse_to_resource');

    // The gdev dashboards folder is visible at root level with dashboards inside.
    // Expand it to reveal the "Bar Gauge Demo" dashboard.
    const gdevFolderRow = page.getByTestId(selectors.pages.BrowseDashboards.table.row('gdev dashboards'));
    await expect(gdevFolderRow).toBeVisible();
    await gdevFolderRow.getByLabel(/Expand folder/).click();

    // Click a dashboard item (non-folder) to trigger select_resource step and navigation
    const dashboardRow = page.getByTestId(selectors.pages.BrowseDashboards.table.row('Bar Gauge Demo'));
    await expect(dashboardRow).toBeVisible();
    await dashboardRow.locator('a').first().click();

    // Wait for the dashboard to fully load (fires dashboards_init_dashboard_completed)
    await page.waitForURL('**/d/**');
    await page.waitForLoadState('networkidle');

    const journey = await journeyRecorder.waitForJourneyEnd('browse_to_resource');
    expect(journey.outcome).toBe('success');
    expect(journey.attributes.resourceType).toBe('dashboard');
    expect(journey.durationMs).toBeGreaterThan(0);
    expect(journey.durationMs).toBeLessThan(30_000);

    // Should have a select_resource step (clicking the dashboard row)
    const selectStep = journey.steps.find((s) => s.name === 'select_resource');
    expect(selectStep).toBeDefined();
  });

  test('folder navigation then dashboard records navigate_folder and select_resource steps', async ({
    page,
    journeyRecorder,
    selectors,
  }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    await journeyRecorder.waitForJourneyStart('browse_to_resource');

    // Click into the test folder (navigates to /dashboards/f/{folderAUID}/)
    const folderRow = page.getByTestId(selectors.pages.BrowseDashboards.table.row(folderATitle));
    await expect(folderRow).toBeVisible();
    await folderRow.locator('a').first().click();

    // Wait for folder contents to load (fires another grafana_browse_dashboards_page_view)
    await page.waitForURL(`**/dashboards/f/${folderAUID}/**`);
    await page.waitForLoadState('networkidle');

    // Click the dashboard inside the folder
    const dashboardRow = page.getByTestId(selectors.pages.BrowseDashboards.table.row(dashInATitle));
    await expect(dashboardRow).toBeVisible();
    await dashboardRow.locator('a').first().click();

    // Wait for the dashboard to load
    await page.waitForURL('**/d/**');
    await page.waitForLoadState('networkidle');

    const journey = await journeyRecorder.waitForJourneyEnd('browse_to_resource');
    expect(journey.outcome).toBe('success');
    expect(journey.attributes.resourceType).toBe('dashboard');
    expect(journey.stepCount).toBe(2);

    // Step 1: navigate_folder (clicking the folder)
    expect(journey.steps[0].name).toBe('navigate_folder');
    expect(journey.steps[0].attributes?.folderUID).toBe(folderAUID);

    // Step 2: select_resource (clicking the dashboard)
    expect(journey.steps[1].name).toBe('select_resource');
  });

  test('multiple folder navigations records correct step count', async ({ page, journeyRecorder, selectors }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    await journeyRecorder.waitForJourneyStart('browse_to_resource');

    // Step 1: Navigate into folder A
    const folderARow = page.getByTestId(selectors.pages.BrowseDashboards.table.row(folderATitle));
    await expect(folderARow).toBeVisible();
    await folderARow.locator('a').first().click();
    await page.waitForURL(`**/dashboards/f/${folderAUID}/**`);
    await page.waitForLoadState('networkidle');

    // Step 2: Navigate into folder B (nested inside A)
    const folderBRow = page.getByTestId(selectors.pages.BrowseDashboards.table.row(folderBTitle));
    await expect(folderBRow).toBeVisible();
    await folderBRow.locator('a').first().click();
    await page.waitForURL(`**/dashboards/f/${folderBUID}/**`);
    await page.waitForLoadState('networkidle');

    // Step 3: Click the dashboard inside folder B
    const dashboardRow = page.getByTestId(selectors.pages.BrowseDashboards.table.row(dashInBTitle));
    await expect(dashboardRow).toBeVisible();
    await dashboardRow.locator('a').first().click();

    await page.waitForURL('**/d/**');
    await page.waitForLoadState('networkidle');

    const journey = await journeyRecorder.waitForJourneyEnd('browse_to_resource');
    expect(journey.outcome).toBe('success');
    expect(journey.stepCount).toBe(3);

    // 2 navigate_folder steps + 1 select_resource step
    const folderSteps = journey.steps.filter((s) => s.name === 'navigate_folder');
    const selectSteps = journey.steps.filter((s) => s.name === 'select_resource');
    expect(folderSteps).toHaveLength(2);
    expect(selectSteps).toHaveLength(1);

    expect(journey.steps[0].name).toBe('navigate_folder');
    expect(journey.steps[1].name).toBe('navigate_folder');
    expect(journey.steps[2].name).toBe('select_resource');
  });

  test('command palette opened and closed does not interrupt active browse journey', async ({
    page,
    journeyRecorder,
    selectors,
  }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    await journeyRecorder.waitForJourneyStart('browse_to_resource');

    // Open command palette while browse journey is active
    const modKey = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modKey}+k`);

    // Wait briefly for the palette to appear (kbar search input has role="combobox")
    const commandPaletteInput = page.getByPlaceholder('Search or jump to...');
    await expect(commandPaletteInput).toBeVisible({ timeout: 3000 });

    // Close the command palette without selecting anything
    await page.keyboard.press('Escape');
    await expect(commandPaletteInput).toBeHidden({ timeout: 3000 });

    // The browse_to_resource journey should still be active (not ended).
    // Verify by completing the browse journey: click a dashboard and confirm success.
    const gdevFolderRow = page.getByTestId(selectors.pages.BrowseDashboards.table.row('gdev dashboards'));
    await expect(gdevFolderRow).toBeVisible();
    await gdevFolderRow.getByLabel(/Expand folder/).click();

    const dashboardRow = page.getByTestId(selectors.pages.BrowseDashboards.table.row('Bar Gauge Demo'));
    await expect(dashboardRow).toBeVisible();
    await dashboardRow.locator('a').first().click();

    await page.waitForURL('**/d/**');
    await page.waitForLoadState('networkidle');

    const journey = await journeyRecorder.waitForJourneyEnd('browse_to_resource');
    expect(journey.outcome).toBe('success');
    expect(journey.attributes.resourceType).toBe('dashboard');
    expect(journey.durationMs).toBeGreaterThan(0);
  });
});
