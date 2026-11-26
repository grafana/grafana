import { isStartFromAvailable, type StartFromDashboard } from '@grafana/assistant';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { ensureV2Response } from 'app/features/dashboard/api/ResponseTransformers';
import { DASHBOARD_SCHEMA_VERSION } from 'app/features/dashboard/state/DashboardMigrator';
import { CustomDashboardTemplateInteractions } from 'app/features/dashboard-scene/analytics/dashboard-templates/main';
import { isPendingChangesEnabled } from 'app/features/dashboard-scene/lifecycle/pendingChangesFlag';
import { loadLibraryDashboard } from 'app/features/dashboard-scene/pages/templateDashboardLoader';
import { getDashboardTemplateExtension } from 'app/features/dashboard-scene/settings/enterprise-components/DashboardTemplateExtension';

/** The parameters of a template page's URL that Grafana reads when the dashboard is saved, to attribute it. */
const ATTRIBUTION_PARAMS = ['sourceEntryPoint', 'libraryItemId', 'creationOrigin', 'assistantSource'];

/**
 * What the Assistant can start a conversation from instead of the template page at `templateUrl`: the
 * dashboard that page opens, as a v2 spec, and the attribution its URL carries. The Assistant keeps the
 * dashboard as the conversation's draft and opens the draft, so the template page never shows, or opens
 * the template page itself when it can't keep the draft. Undefined where it can't start from it (no
 * dashboards as artifacts, or an Assistant that predates it), when the template doesn't load, and for a
 * template on an older schema, which only the template page migrates: open the template page then.
 */
export async function getTemplateStartFrom(templateUrl: string): Promise<StartFromDashboard | undefined> {
  if (!isPendingChangesEnabled() || !isStartFromAvailable()) {
    return undefined;
  }
  const params = new URLSearchParams(templateUrl.includes('?') ? templateUrl.slice(templateUrl.indexOf('?')) : '');
  try {
    const spec = await loadTemplateSpec(params);
    if (!spec) {
      return undefined;
    }
    const query: Record<string, string> = {};
    for (const key of ATTRIBUTION_PARAMS) {
      const value = params.get(key);
      if (value) {
        query[key] = value;
      }
    }
    return { spec, query, fallbackUrl: templateUrl };
  } catch (error) {
    console.warn('Could not load the template for the Assistant to start from:', error);
    return undefined;
  }
}

/** The dashboard the template page opens, as the page loads it, as a v2 spec; undefined when only the page can. */
async function loadTemplateSpec(params: URLSearchParams): Promise<DashboardV2Spec | undefined> {
  const templateUid = params.get('dashboardTemplateUid');
  if (templateUid) {
    const response = await getDashboardTemplateExtension().loadTemplate(templateUid);
    // The template page reports this as it loads a custom template to use.
    CustomDashboardTemplateInteractions.loaded({ templateUid, mode: 'use' });
    return response.spec.dashboard;
  }
  // Grafana's own templates are v1 dashboards; the conversion keeps their rows.
  const template = await loadLibraryDashboard(params);
  // The conversion skips the schema migrations the template page runs as it opens a v1 dashboard.
  if ((template.dashboard.schemaVersion ?? 0) < DASHBOARD_SCHEMA_VERSION) {
    return undefined;
  }
  return ensureV2Response(template).spec;
}
