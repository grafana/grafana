import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import {
  getDashboardValidationIssues,
  type DashboardValidationIssues,
} from 'app/features/dashboard-scene/validation/getDashboardValidationIssues';

/** The active dashboard scene, if one is mounted. Set by DashboardScene on activation. */
function getActiveDashboardScene(): DashboardScene | undefined {
  const context = window.__grafanaSceneContext;
  return context instanceof DashboardScene ? context : undefined;
}

/**
 * Post-build backstop for the wizard: checks the freshly generated dashboard
 * for problems the build agent commonly leaves behind (see
 * getDashboardValidationIssues — currently undefined template variables). The
 * same check is exposed to the assistant as the VALIDATE_DASHBOARD mutation
 * command / validate_dashboard tool so agents can self-check mid-build; this
 * host-side pass stays as a deterministic safety net for the wizard flow.
 *
 * Defaults to the active dashboard scene so callers can run it right after a
 * build completes; pass a scene explicitly in tests.
 */
export function validateGeneratedDashboard(scene = getActiveDashboardScene()): DashboardValidationIssues {
  if (!scene) {
    return { undefinedVariables: [] };
  }
  return getDashboardValidationIssues(scene);
}
