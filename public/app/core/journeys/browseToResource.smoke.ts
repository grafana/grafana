import { type Page } from '@playwright/test';

import { jitter } from './__smoke__/playwright-utils.ts';
import { type JourneyDriver } from './__smoke__/types.ts';

// Title of the fixture dashboard auto-created by the smoke runner. Kept in
// sync with FIXTURE_TITLE in scripts/cuj-smoke.ts so the open-fixture scenario
// has a stable target row in the browse-dashboards table.
const FIXTURE_TITLE = 'CUJ Smoke Fixture';

const BROWSE_TO_RESOURCE_SCENARIOS = ['open-fixture', 'abandon'] as const;

const BROWSE_DASHBOARDS_TABLE = 'data-testid browse-dashboards-table';
const BROWSE_DASHBOARDS_ROW = `data-testid browse dashboards row ${FIXTURE_TITLE}`;

/**
 * Navigate to /dashboards and click the fixture row. Triggers
 * grafana_browse_dashboards_page_view + page_click_list_item +
 * dashboards_init_dashboard_completed -> success.
 */
async function openFixture(page: Page): Promise<void> {
  await page.goto('/dashboards');
  try {
    await page.getByTestId(BROWSE_DASHBOARDS_TABLE).waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    return;
  }

  const fixtureRow = page.getByTestId(BROWSE_DASHBOARDS_ROW);
  try {
    await fixtureRow.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    // Fixture row not in viewport (large folder list); the page_view start
    // already fired so let the journey time out as `timeout`.
    return;
  }

  await page.waitForTimeout(200 + jitter(400));
  await fixtureRow.getByRole('link').first().click();
  // Wait for the dashboard URL so dashboards_init_dashboard_completed has time to fire.
  try {
    await page.waitForURL(/\/d\/cuj-smoke-fixture/, { timeout: 10_000 });
  } catch {
    // Click missed; journey will end via timeout.
  }
}

/**
 * Land on /dashboards (start fires) and immediately navigate home without
 * clicking anything. Journey ends via timeout or tab unload.
 */
async function abandon(page: Page): Promise<void> {
  await page.goto('/dashboards');
  try {
    await page.getByTestId(BROWSE_DASHBOARDS_TABLE).waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    // Even the table didn't show — the page_view interaction may still have fired.
  }
  await page.waitForTimeout(300 + jitter(700));
  await page.goto('/');
}

export const browseToResourceDriver: JourneyDriver = {
  type: 'browse_to_resource',
  scenarios: BROWSE_TO_RESOURCE_SCENARIOS,
  async runScenario(page: Page, scenario: string): Promise<void> {
    switch (scenario) {
      case 'open-fixture':
        return openFixture(page);
      case 'abandon':
        return abandon(page);
      default:
        throw new Error(`browse_to_resource: unknown scenario "${scenario}"`);
    }
  },
};
