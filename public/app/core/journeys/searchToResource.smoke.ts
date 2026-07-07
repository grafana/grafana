import { type Page } from '@playwright/test';

import { activate, humanType, jitter, openCommandPalette, pickQuery } from './__smoke__/playwright-utils.ts';
import { type JourneyDriver } from './__smoke__/types.ts';

// Title of the fixture dashboard auto-created by the smoke runner. Kept in
// sync with FIXTURE_TITLE in scripts/cuj-smoke.ts so the existing-dashboard
// scenario has a stable target to search for.
const FIXTURE_TITLE = 'CUJ Smoke Fixture';

const SEARCH_TO_RESOURCE_SCENARIOS = [
  'new-dashboard',
  'home-dashboard',
  'import-dashboard',
  'existing-dashboard',
  'discarded',
] as const;

// Per-scenario query variants. The runner picks one uniformly so the dashboard
// sees a realistic spread of query strings, casings, and lengths.
const SEARCH_TO_RESOURCE_QUERIES: Record<string, string[]> = {
  'new-dashboard': ['new dashboard', 'new', 'create dashboard', 'new dash'],
  'home-dashboard': ['home', 'Home', 'home dashboard'],
  'import-dashboard': ['import', 'import dashboard'],
  'existing-dashboard': [FIXTURE_TITLE, 'CUJ Smoke', 'cuj smoke', 'smoke fixture'],
  discarded: ['something'],
};

/**
 * Search for a query, wait for the first result, activate it. Query, typing
 * cadence, and activation modality are all randomised so the dashboard sees
 * a realistic spread of telemetry shapes.
 */
async function searchAndActivate(page: Page, scenario: string): Promise<void> {
  await openCommandPalette(page);
  await humanType(page, pickQuery(scenario, SEARCH_TO_RESOURCE_QUERIES));
  // kbar's dashboard search is async; allow up to 10s. If results never show
  // (or the query genuinely matches nothing), fall back to Escape so the
  // journey ends as `discarded` instead of leaving its 60s timeout running.
  const firstOption = page.getByRole('option').first();
  try {
    await firstOption.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    await page.keyboard.press('Escape');
    return;
  }
  await activate(page);
}

async function runDiscarded(page: Page): Promise<void> {
  const r = Math.random();
  if (r < 0.2) {
    // immediate-close: open and bail before typing anything.
    await openCommandPalette(page);
    await page.waitForTimeout(200 + jitter(800));
    await page.keyboard.press('Escape');
    return;
  }

  await openCommandPalette(page);
  const query = pickQuery('discarded', SEARCH_TO_RESOURCE_QUERIES);
  await humanType(page, query);

  if (r < 0.6) {
    // type-and-abandon
    await page.keyboard.press('Escape');
    return;
  }

  // type-clear-abandon: backspace through the query before escaping.
  for (let i = 0; i < query.length; i++) {
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(40 + jitter(60));
  }
  await page.waitForTimeout(300 + jitter(500));
  await page.keyboard.press('Escape');
}

export const searchToResourceDriver: JourneyDriver = {
  type: 'search_to_resource',
  scenarios: SEARCH_TO_RESOURCE_SCENARIOS,
  queryVariants: SEARCH_TO_RESOURCE_QUERIES,
  async runScenario(page: Page, scenario: string): Promise<void> {
    switch (scenario) {
      case 'new-dashboard':
      case 'home-dashboard':
      case 'import-dashboard':
      case 'existing-dashboard':
        return searchAndActivate(page, scenario);
      case 'discarded':
        return runDiscarded(page);
      default:
        throw new Error(`search_to_resource: unknown scenario "${scenario}"`);
    }
  },
};
