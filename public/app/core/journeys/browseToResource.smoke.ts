import { type Page } from '@playwright/test';

import { jitter, spaNavigate, spaNavigateHome } from './__smoke__/playwright-utils.ts';
import { type JourneyDriver } from './__smoke__/types.ts';

// Title of the fixture dashboard auto-created by the smoke runner. Kept in
// sync with FIXTURE_TITLE in scripts/cuj-smoke.ts so the open-fixture scenario
// has a stable target row in the browse-dashboards table.
const FIXTURE_TITLE = 'CUJ Smoke Fixture';
const FIXTURE_PATH = '/d/cuj-smoke-fixture';

const BROWSE_TO_RESOURCE_SCENARIOS = ['open-fixture', 'abandon'] as const;

const BROWSE_DASHBOARDS_TABLE = 'data-testid browse-dashboards-table';
const BROWSE_DASHBOARDS_ROW = `data-testid browse dashboards row ${FIXTURE_TITLE}`;

/**
 * Navigate to /dashboards (page_view starts the journey), then click the
 * fixture row if it's rendered. The browse table is virtualised, so in test
 * envs with many dashboards the fixture row may not be in DOM - fall back to
 * SPA-navigating directly to the fixture so the journey still ends cleanly
 * via dashboards_init_dashboard_completed.
 */
async function openFixture(page: Page): Promise<void> {
  await page.goto('/dashboards');
  try {
    await page.getByTestId(BROWSE_DASHBOARDS_TABLE).waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    return;
  }
  await page.waitForTimeout(200 + jitter(400));

  const fixtureRow = page.getByTestId(BROWSE_DASHBOARDS_ROW);
  let clicked = false;
  if ((await fixtureRow.count()) > 0) {
    try {
      await fixtureRow.getByRole('link').first().click({ timeout: 3_000 });
      clicked = true;
    } catch {
      // Fall through to SPA nav.
    }
  }

  if (!clicked) {
    // Row not virtualised in or click failed - SPA-navigate so
    // dashboards_init_dashboard_completed still fires in the same context
    // (page_view start already fired on /dashboards).
    await spaNavigate(page, FIXTURE_PATH);
  }

  try {
    await page.waitForURL(/\/d\/cuj-smoke-fixture/, { timeout: 10_000 });
  } catch {
    // Navigation didn't land - journey will time out.
  }
}

/**
 * Land on /dashboards (start fires) and SPA-navigate home without clicking
 * anything. Journey ends as `abandoned` via abandonOnRouteChange when the
 * locationService observer sees the route leave the browse area.
 */
async function abandon(page: Page): Promise<void> {
  await page.goto('/dashboards');
  try {
    await page.getByTestId(BROWSE_DASHBOARDS_TABLE).waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    // Even the table didn't show — the page_view interaction may still have fired.
  }
  await page.waitForTimeout(300 + jitter(700));
  // SPA-navigate so abandonOnRouteChange (locationService observer) fires in
  // the same JS context. A hard `page.goto('/')` would trigger beforeunload but
  // the unload context tears down before Faro can flush the abandon event.
  await spaNavigateHome(page);
  await page.waitForTimeout(500);
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
