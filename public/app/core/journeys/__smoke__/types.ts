import { type Page } from '@playwright/test';

/**
 * Per-journey smoke driver. The orchestrator (scripts/cuj-smoke.ts) picks a
 * driver from the registry and calls runScenario for each iteration.
 *
 * Each journey owns its own driver file alongside its wiring (e.g.
 * searchToResource.smoke.ts next to searchToResource.ts) so adding a new
 * journey to the smoke runner is a purely additive change.
 */
export interface JourneyDriver {
  type: string;
  scenarios: readonly string[];
  queryVariants?: Record<string, string[]>;
  runScenario(page: Page, scenario: string): Promise<void>;
}
