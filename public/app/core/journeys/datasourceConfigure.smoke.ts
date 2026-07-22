import { type Page } from '@playwright/test';

import { jitter, spaNavigateHome } from './__smoke__/playwright-utils.ts';
import { type JourneyDriver } from './__smoke__/types.ts';

const DATASOURCE_CONFIGURE_SCENARIOS = ['cancel-flow', 'navigate-away'] as const;

const NEW_DATASOURCE_PATH = '/datasources/new';

/**
 * Land on /datasources/new (start fires via connections_new_datasource_page_view),
 * then click Cancel. End: discarded via connections_new_datasource_cancelled.
 */
async function cancelFlow(page: Page): Promise<void> {
  await page.goto(NEW_DATASOURCE_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400 + jitter(600));
  // LinkButton in NewDataSource.tsx — accessible name is the i18n "Cancel" label.
  await page.getByRole('link', { name: 'Cancel' }).click();
  await page.waitForTimeout(500);
}

/**
 * Land on /datasources/new (start fires), SPA-navigate home without finishing.
 * End: abandoned via NewDataSourcePage unmount -> connections_new_datasource_page_left.
 */
async function navigateAway(page: Page): Promise<void> {
  await page.goto(NEW_DATASOURCE_PATH);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300 + jitter(700));
  await spaNavigateHome(page);
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
