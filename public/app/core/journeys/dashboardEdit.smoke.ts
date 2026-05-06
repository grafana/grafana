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
const DASHBOARD_SAVE_DRAWER_BUTTON = 'data-testid Save dashboard drawer button';
const TIME_PICKER_OPEN_BUTTON = 'data-testid TimePicker Open Button';
const SAVE_TIMERANGE_CHECKBOX = 'data-testid Dashboard settings Save Dashboard Modal Save timerange checkbox';

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
 * Enter edit mode, dirty the dashboard via a time-range change, click Save,
 * then submit the save drawer. End: success.
 *
 * The fixture has no panel changes to commit, so the save drawer's primary
 * button stays disabled on a no-diff dashboard. Picking a time-range preset
 * + ticking "Save current time range" creates a real diff so the drawer's
 * submit enables and `grafana_dashboard_saved` fires.
 */
async function saveEdit(page: Page): Promise<void> {
  if (!(await openFixtureAndEdit(page))) {
    return;
  }

  // Dirty the dashboard. Time range alone doesn't dirty the model; the
  // drawer's "Save current time range" checkbox creates the diff. Pick a
  // preset that differs from the dashboard's currently-saved range (the URL
  // reflects whatever was persisted last) so back-to-back runs don't all
  // pick the same range and hit a no-diff state.
  const TIME_PRESETS: Array<{ label: string; from: string }> = [
    { label: 'Last 30 minutes', from: 'now-30m' },
    { label: 'Last 1 hour', from: 'now-1h' },
    { label: 'Last 3 hours', from: 'now-3h' },
    { label: 'Last 6 hours', from: 'now-6h' },
    { label: 'Last 12 hours', from: 'now-12h' },
    { label: 'Last 24 hours', from: 'now-24h' },
  ];
  const currentFrom = new URL(page.url()).searchParams.get('from') ?? '';
  const candidates = TIME_PRESETS.filter((p) => p.from !== currentFrom);
  const preset = candidates[Math.floor(Math.random() * candidates.length)];
  try {
    await page.getByTestId(TIME_PICKER_OPEN_BUTTON).click({ timeout: 3_000 });
    await page.getByText(preset.label, { exact: true }).first().click({ timeout: 3_000 });
    await page.waitForTimeout(300 + jitter(300));
  } catch {
    // Time picker change failed; bail and let the journey time out.
    return;
  }

  try {
    await page.getByTestId(SAVE_BUTTON).waitFor({ state: 'visible', timeout: 5_000 });
    await page.getByTestId(SAVE_BUTTON).click();
  } catch {
    return;
  }

  // Toggle via dispatchEvent: a real `.click()` is intercepted by the
  // label-description span and a force click can land outside the headless
  // viewport. Dispatching `click` directly on the input element fires the
  // change handler reliably.
  try {
    const cb = page.getByTestId(SAVE_TIMERANGE_CHECKBOX);
    await cb.waitFor({ state: 'attached', timeout: 5_000 });
    await cb.dispatchEvent('click');
    await page.waitForTimeout(200);
  } catch {
    return;
  }

  try {
    await page.getByTestId(DASHBOARD_SAVE_DRAWER_BUTTON).waitFor({ state: 'visible', timeout: 5_000 });
    await page.getByTestId(DASHBOARD_SAVE_DRAWER_BUTTON).click();
  } catch {
    return;
  }
  await page.waitForTimeout(1000);
}

/**
 * Enter edit mode, click the toggle (or Exit) to leave. Journey ends as
 * `discarded` via dashboards_edit_exited (fires on every exit regardless of
 * dirty state) - no need to chase the Discard confirmation.
 *
 * Two toolbar layouts exist: the new toolbar uses one button that toggles
 * between Edit and Exit (keeps the `editButton` testid); the old toolbar
 * renders a separate `exitButton`. Try the toggle first, fall back to the
 * dedicated exit button.
 */
async function discardEdit(page: Page): Promise<void> {
  if (!(await openFixtureAndEdit(page))) {
    return;
  }

  try {
    await page.getByTestId(EDIT_BUTTON).click({ timeout: 3_000 });
  } catch {
    try {
      await page.getByTestId(EXIT_BUTTON).click({ timeout: 3_000 });
    } catch {
      return;
    }
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
