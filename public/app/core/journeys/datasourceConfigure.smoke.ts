import { type Page } from '@playwright/test';

import { jitter } from './__smoke__/playwright-utils.ts';
import { type JourneyDriver } from './__smoke__/types.ts';

const DATASOURCE_CONFIGURE_SCENARIOS = ['cancel-flow', 'navigate-away'] as const;

const NEW_DATASOURCE_PATH = '/datasources/new';

/**
 * Land on /datasources/new (start fires via connections_new_datasource_page_view),
 * then navigate back home to trigger the Cancel / leave path.
 *
 * `connections_new_datasource_cancelled` is documented but is only emitted when
 * a user clicks Cancel inside the catalog UI. Without a stable Cancel selector
 * we go via plain back-navigation; the page-leave handler ends the journey as
 * `abandoned` (config_page_left). Same effective signal: an end event reaches
 * the tracker for every iteration.
 */
async function cancelFlow(page: Page): Promise<void> {
  await page.goto(NEW_DATASOURCE_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400 + jitter(600));

  // Try to use the browser back button — closest analogue to a "cancel" click
  // on the catalog page that doesn't depend on knowing the exact button label.
  try {
    await page.goBack({ timeout: 5_000 });
  } catch {
    await page.goto('/');
  }
  await page.waitForTimeout(500);
}

/**
 * Land on /datasources/new (start fires), navigate to / without finishing.
 * End: abandoned (config_page_left fires on unmount).
 */
async function navigateAway(page: Page): Promise<void> {
  await page.goto(NEW_DATASOURCE_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300 + jitter(700));
  await page.goto('/');
  await page.waitForTimeout(500);
}

export const datasourceConfigureDriver: JourneyDriver = {
  type: 'datasource_configure',
  scenarios: DATASOURCE_CONFIGURE_SCENARIOS,
  async runScenario(page: Page, scenario: string): Promise<void> {
    switch (scenario) {
      case 'cancel-flow':
        return cancelFlow(page);
      case 'navigate-away':
        return navigateAway(page);
      default:
        throw new Error(`datasource_configure: unknown scenario "${scenario}"`);
    }
  },
};
