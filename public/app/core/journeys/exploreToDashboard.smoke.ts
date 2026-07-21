import { type Page } from '@playwright/test';

import { type JourneyDriver } from './__smoke__/types.ts';

/**
 * Stub driver. The "Add to dashboard" flow is too involved to script reliably
 * without a working backend datasource and a stable selector for the modal's
 * submit/cancel buttons. The journey wiring also relies on `e_2_d_open` /
 * `e_2_d_submit` / `e_2_d_discarded` reportInteraction calls that are not yet
 * present in the Explore code — those are forward-looking events documented in
 * exploreToDashboard.ts but not yet emitted.
 *
 * Registering an empty driver here keeps the journey listed by --help and lets
 * the runtime fail loudly with a clear message if anyone accidentally selects
 * it via --journeys explore_to_dashboard.
 */
export const exploreToDashboardDriver: JourneyDriver = {
  type: 'explore_to_dashboard',
  scenarios: [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async runScenario(_page: Page, scenario: string): Promise<void> {
    throw new Error(
      `explore_to_dashboard smoke driver is not yet implemented (scenario "${scenario}"). ` +
        `The "Add to dashboard" flow needs a working datasource and stable selectors; ` +
        `wire it up once those are in place.`
    );
  },
};
