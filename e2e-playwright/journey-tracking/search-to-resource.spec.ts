import { test, expect } from './fixture';

test.use({
  featureToggles: {
    cujTracking: true,
    dashboardNewLayouts: false,
  },
});

test.describe('search_to_resource journey tracking', { tag: ['@journey-tracking'] }, () => {
  test('command palette search to dashboard records a successful journey', async ({
    page,
    journeyRecorder,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open the command palette via keyboard shortcut
    const modKey = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modKey}+k`);

    // Wait for the search input to appear (the combobox role input inside the palette)
    const searchInput = page.getByRole('combobox');
    await expect(searchInput).toBeVisible();

    // Verify journey started from command_palette_opened interaction
    await journeyRecorder.waitForJourneyStart('search_to_resource');

    // Type a search query to find a dashboard
    await searchInput.fill('Panel Tests - Bar Gauge');

    // Wait for search results to load, then select a dashboard result.
    // kbar renders results inside a listbox with role="option" items.
    const dashboardResult = page.getByRole('option').filter({ hasText: /Panel Tests - Bar Gauge/i }).first();
    await expect(dashboardResult).toBeVisible({ timeout: 10_000 });
    await dashboardResult.click();

    // Wait for the dashboard page to load (URL contains /d/ for dashboard routes)
    await page.waitForURL('**/d/**', { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Assert the journey completed successfully
    const journey = await journeyRecorder.waitForJourneyEnd('search_to_resource');
    expect(journey.outcome).toBe('success');
    expect(journey.attributes.source).toBe('command_palette');
    expect(journey.attributes.resourceType).toBe('dashboard');
    expect(journey.durationMs).toBeGreaterThan(0);
    expect(journey.durationMs).toBeLessThan(30_000);
    expect(journey.stepCount).toBe(0);
  });

  test('command palette opened and closed without selection records a discarded journey', async ({
    page,
    journeyRecorder,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open the command palette
    const modKey = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modKey}+k`);

    const searchInput = page.getByRole('combobox');
    await expect(searchInput).toBeVisible();

    await journeyRecorder.waitForJourneyStart('search_to_resource');

    // Close the palette without selecting anything
    await page.keyboard.press('Escape');

    // Assert the journey ended as discarded
    const journey = await journeyRecorder.waitForJourneyEnd('search_to_resource');
    expect(journey.outcome).toBe('discarded');
    expect(journey.attributes.source).toBe('command_palette');
    expect(journey.stepCount).toBe(0);
  });

  test('selecting a non-dashboard action sets resourceType to other', async ({
    page,
    journeyRecorder,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open the command palette
    const modKey = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modKey}+k`);

    const searchInput = page.getByRole('combobox');
    await expect(searchInput).toBeVisible();

    await journeyRecorder.waitForJourneyStart('search_to_resource');

    // Type a query that matches a non-dashboard action (e.g. the "Explore" page)
    await searchInput.fill('Explore');

    // Select the Explore navigation action from the results
    const exploreResult = page.getByRole('option').filter({ hasText: /^Explore/ }).first();
    await expect(exploreResult).toBeVisible({ timeout: 10_000 });
    await exploreResult.click();

    // Wait for navigation away from the home page
    await page.waitForURL('**/explore**', { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Navigating to a non-dashboard page does not fire
    // dashboards_init_dashboard_completed, so the journey won't end as 'success'.
    // The palette unmount fires command_palette_closed, but since
    // command_palette_action_selected already set actionSelected=true in the end
    // handler, the discard path is skipped. The journey stays active until timeout.
    //
    // Waiting for the full timeout (60s) is too slow for CI. Instead, verify the
    // setAttributes call was logged with resourceType: 'other' by inspecting the
    // raw console output captured by the recorder. This confirms the mid-journey
    // attribute enrichment path works correctly for non-dashboard actions.
    const logs = journeyRecorder.getRawLogs();
    const setAttributesLog = logs.find(
      (log) => log.includes('setAttributes') && log.includes('search_to_resource')
    );
    expect(setAttributesLog).toBeDefined();
    expect(setAttributesLog).toContain('other');

    // Verify the journey was started (source=command_palette is validated via structured
    // attributes in the other tests; raw log serializes nested objects as "Object")
    const startLog = logs.find(
      (log) => log.includes('startJourney') && log.includes('search_to_resource')
    );
    expect(startLog).toBeDefined();
  });
});
