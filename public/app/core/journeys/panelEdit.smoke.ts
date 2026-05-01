import { type Page } from '@playwright/test';

import { jitter } from './__smoke__/playwright-utils.ts';
import { type JourneyDriver } from './__smoke__/types.ts';

const PANEL_EDIT_SCENARIOS = ['open-panel-edit', 'cancel-panel-edit'] as const;

const FIXTURE_PATH = '/d/cuj-smoke-fixture';
// The fixture dashboard ships a single text panel titled "CUJ Smoke Panel"
// — see ensureFixtureDashboard in scripts/cuj-smoke.ts.
const FIXTURE_PANEL_TITLE = 'CUJ Smoke Panel';

const PANEL_HEADER = `data-testid Panel header ${FIXTURE_PANEL_TITLE}`;
const PANEL_MENU = `data-testid Panel menu ${FIXTURE_PANEL_TITLE}`;
const PANEL_MENU_ITEM_EDIT = 'data-testid Panel menu item Edit';
const PANEL_EDITOR_CONTENT = 'data-testid Panel editor content';
const BACK_TO_DASHBOARD_BUTTON = 'data-testid Back to dashboard button';
const DISCARD_CHANGES_BUTTON = 'data-testid Discard changes button';

/**
 * Open the fixture dashboard, hover the fixture panel, click its menu, then Edit.
 * Returns true if we landed in panel edit mode.
 */
async function enterPanelEdit(page: Page): Promise<boolean> {
  await page.goto(FIXTURE_PATH);
  try {
    await page.getByTestId(PANEL_HEADER).waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    return false;
  }

  // Hover so the menu trigger renders.
  await page.getByTestId(PANEL_HEADER).hover();
  await page.waitForTimeout(150 + jitter(250));

  try {
    await page.getByTestId(PANEL_MENU).click({ timeout: 5_000 });
  } catch {
    return false;
  }

  try {
    await page.getByTestId(PANEL_MENU_ITEM_EDIT).waitFor({ state: 'visible', timeout: 5_000 });
    await page.getByTestId(PANEL_MENU_ITEM_EDIT).click();
  } catch {
    return false;
  }

  try {
    await page.getByTestId(PANEL_EDITOR_CONTENT).waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    return false;
  }

  return true;
}

/**
 * Open panel edit and immediately exit via Back to dashboard. End: success
 * (no discard fired, panel_edit_closed -> success).
 */
async function openPanelEdit(page: Page): Promise<void> {
  if (!(await enterPanelEdit(page))) {
    return;
  }

  await page.waitForTimeout(300 + jitter(500));

  try {
    await page.getByTestId(BACK_TO_DASHBOARD_BUTTON).click({ timeout: 5_000 });
  } catch {
    // Couldn't exit via the button; press Escape to attempt close.
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(500);
}

/**
 * Open panel edit, then attempt to discard. If no Discard button surfaces
 * (no diff to discard), exit via Back to dashboard which still ends as
 * `success` — acceptable signal for smoke.
 */
async function cancelPanelEdit(page: Page): Promise<void> {
  if (!(await enterPanelEdit(page))) {
    return;
  }

  await page.waitForTimeout(200 + jitter(400));

  try {
    await page.getByTestId(DISCARD_CHANGES_BUTTON).waitFor({ state: 'visible', timeout: 3_000 });
    await page.getByTestId(DISCARD_CHANGES_BUTTON).click();
    await page.waitForTimeout(500);
    return;
  } catch {
    // Fall through to plain exit.
  }

  try {
    await page.getByTestId(BACK_TO_DASHBOARD_BUTTON).click({ timeout: 5_000 });
  } catch {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(500);
}

export const panelEditDriver: JourneyDriver = {
  type: 'panel_edit',
  scenarios: PANEL_EDIT_SCENARIOS,
  async runScenario(page: Page, scenario: string): Promise<void> {
    switch (scenario) {
      case 'open-panel-edit':
        return openPanelEdit(page);
      case 'cancel-panel-edit':
        return cancelPanelEdit(page);
      default:
        throw new Error(`panel_edit: unknown scenario "${scenario}"`);
    }
  },
};
