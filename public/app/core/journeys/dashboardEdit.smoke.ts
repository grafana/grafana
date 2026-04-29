import { type Page } from '@playwright/test';

import { jitter } from './__smoke__/playwright-utils.ts';
import { type JourneyDriver } from './__smoke__/types.ts';

const DASHBOARD_EDIT_SCENARIOS = ['save-edit', 'discard-edit'] as const;

const FIXTURE_PATH = '/d/cuj-smoke-fixture';

// Mirror of selectors.components.NavToolbar.editDashboard.* — kept inline
// because the smoke runner runs as plain Node and @grafana/e2e-selectors isn't
// imported here.
const EDIT_BUTTON = 'data-testid Edit dashboard button';
const SAVE_BUTTON = 'data-testid Save dashboard button';
const EXIT_BUTTON = 'data-testid Exit edit mode button';
const DISCARD_CHANGES_BUTTON = 'data-testid Discard changes button';
const DASHBOARD_SAVE_DRAWER_BUTTON = 'data-testid Save dashboard drawer button';

async function openFixtureAndEdit(page: Page): Promise<boolean> {
  await page.goto(FIXTURE_PATH);
  try {
    await page.getByTestId(EDIT_BUTTON).waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    return false;
  }
  await page.getByTestId(EDIT_BUTTON).click();
  // Edit mode wires in async — give the toolbar time to swap.
  await page.waitForTimeout(300 + jitter(400));
  return true;
}

/**
 * Enter edit mode, click Save, then submit the save drawer. End: success.
 */
async function saveEdit(page: Page): Promise<void> {
  if (!(await openFixtureAndEdit(page))) {
    return;
  }

  try {
    await page.getByTestId(SAVE_BUTTON).waitFor({ state: 'visible', timeout: 5_000 });
    await page.getByTestId(SAVE_BUTTON).click();
  } catch {
    // No save button surfaced; bail and let the journey time out.
    return;
  }

  // Confirm save via the drawer's primary button. If the drawer doesn't open
  // (no diff), the journey will instead time out — acceptable for smoke.
  try {
    await page.getByTestId(DASHBOARD_SAVE_DRAWER_BUTTON).waitFor({ state: 'visible', timeout: 5_000 });
    await page.getByTestId(DASHBOARD_SAVE_DRAWER_BUTTON).click();
  } catch {
    return;
  }
  await page.waitForTimeout(1000);
}

/**
 * Enter edit mode, click Exit, confirm Discard. End: discarded.
 */
async function discardEdit(page: Page): Promise<void> {
  if (!(await openFixtureAndEdit(page))) {
    return;
  }

  try {
    await page.getByTestId(EXIT_BUTTON).waitFor({ state: 'visible', timeout: 5_000 });
    await page.getByTestId(EXIT_BUTTON).click();
  } catch {
    return;
  }

  // The discard confirmation only renders if there are changes; without a
  // mid-edit change we may exit cleanly without it. Try the explicit discard
  // path; if absent, the journey ends via the editleave handler.
  try {
    await page.getByTestId(DISCARD_CHANGES_BUTTON).waitFor({ state: 'visible', timeout: 3_000 });
    await page.getByTestId(DISCARD_CHANGES_BUTTON).click();
  } catch {
    // No confirm needed — exit was clean.
  }
  await page.waitForTimeout(500);
}

export const dashboardEditDriver: JourneyDriver = {
  type: 'dashboard_edit',
  scenarios: DASHBOARD_EDIT_SCENARIOS,
  async runScenario(page: Page, scenario: string): Promise<void> {
    switch (scenario) {
      case 'save-edit':
        return saveEdit(page);
      case 'discard-edit':
        return discardEdit(page);
      default:
        throw new Error(`dashboard_edit: unknown scenario "${scenario}"`);
    }
  },
};
