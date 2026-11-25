import { isStartFromAvailable, type StartFromDashboard } from '@grafana/assistant';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { ensureV2Response } from 'app/features/dashboard/api/ResponseTransformers';
import { CustomDashboardTemplateInteractions } from 'app/features/dashboard-scene/analytics/dashboard-templates/main';
import { isPendingChangesEnabled } from 'app/features/dashboard-scene/lifecycle/pendingChangesFlag';
import { loadLibraryDashboard } from 'app/features/dashboard-scene/pages/templateDashboardLoader';
import { getDashboardTemplateExtension } from 'app/features/dashboard-scene/settings/enterprise-components/DashboardTemplateExtension';

/** The parameters of a template page's URL that Grafana reads when the dashboard is saved, to attribute it. */
const ATTRIBUTION_PARAMS = ['sourceEntryPoint', 'libraryItemId', 'creationOrigin', 'assistantSource'];

/**
 * What the Assistant can start a conversation from instead of the template page at `templateUrl`: the
 * dashboard that page opens, as a v2 spec, and the attribution its URL carries. The Assistant keeps the
 * dashboard as the conversation's draft and opens the draft, so the template page never shows. Undefined
 * where it can't (no dashboards as artifacts, or an Assistant that predates it) and when the template
 * doesn't load: open the template page then.
 */
export async function getTemplateStartFrom(templateUrl: string): Promise<StartFromDashboard | undefined> {
  if (!isPendingChangesEnabled() || !isStartFromAvailable()) {
    return undefined;
  }
  const params = new URLSearchParams(templateUrl.includes('?') ? templateUrl.slice(templateUrl.indexOf('?')) : '');
  try {
    const spec = await loadTemplateSpec(params);
    const query: Record<string, string> = {};
    for (const key of ATTRIBUTION_PARAMS) {
      const value = params.get(key);
      if (value) {
        query[key] = value;
      }
    }
    return { spec, query };
  } catch (error) {
    console.warn('Could not load the template for the Assistant to start from:', error);
    return undefined;
  }
}

/** The dashboard the template page opens, as the page loads it, as a v2 spec. */
async function loadTemplateSpec(params: URLSearchParams): Promise<DashboardV2Spec> {
  const templateUid = params.get('dashboardTemplateUid');
  if (templateUid) {
    const response = await getDashboardTemplateExtension().loadTemplate(templateUid);
    // The template page reports this as it loads a custom template to use.
    CustomDashboardTemplateInteractions.loaded({ templateUid, mode: 'use' });
    return response.spec.dashboard;
  }
  // Grafana's own templates are v1 dashboards; the conversion keeps their rows.
  return ensureV2Response(await loadLibraryDashboard(params)).spec;
}
