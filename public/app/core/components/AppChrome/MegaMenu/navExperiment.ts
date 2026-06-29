import { reportExperimentView } from '@grafana/runtime';

import { contextSrv } from '../../../services/context_srv';

/**
 * Instrumentation for the Configurable Nav A/B experiment (behind `grafana.customizableMegaMenu`).
 *
 * The assigned variant is cached in module scope so the KPI interactions (nav clicks, pin/unpin)
 * can be stamped with it without threading the value through `enrichWithInteractionTracking` (which
 * is recursive and called in several places). The exposure (denominator) event is fired once per
 * page load via {@link reportNavExperimentViewOnce}.
 */
export const NAV_EXPERIMENT_ID = 'navCustomization';
export const NAV_EXPERIMENT_GROUP = 'rollout';

export type NavExperimentVariant = 'treatment' | 'control';

let currentVariant: NavExperimentVariant | undefined;
let hasExposed = false;

export function setNavExperimentVariant(variant: NavExperimentVariant) {
  currentVariant = variant;
}

/**
 * Extra properties stamped onto the existing KPI interactions so they can be attributed to the
 * experiment variant (and filtered to the eligible cohort by `org_id` at analysis time).
 */
export function getNavExperimentPayload(): Record<string, unknown> {
  if (!currentVariant) {
    return {};
  }
  return {
    experiment_nav_customization: currentVariant,
    org_id: contextSrv.user.orgId,
  };
}

/**
 * Fire the exposure event once per page load. Guarded by a module-scope boolean so opening the menu
 * repeatedly doesn't re-emit it (which would inflate the denominator).
 */
export function reportNavExperimentViewOnce(variant: NavExperimentVariant) {
  if (hasExposed) {
    return;
  }
  hasExposed = true;
  reportExperimentView(NAV_EXPERIMENT_ID, NAV_EXPERIMENT_GROUP, variant);
}

/** Test-only: reset the module-scope exposure guard and cached variant between tests. */
export function resetNavExperimentStateForTests() {
  currentVariant = undefined;
  hasExposed = false;
}
