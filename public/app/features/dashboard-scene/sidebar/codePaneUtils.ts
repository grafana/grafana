import yaml from 'js-yaml';

import { t } from '@grafana/i18n';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { ensureV2Response } from '../../dashboard/api/ResponseTransformers';
import { isDashboardV2Spec } from '../../dashboard/api/utils';

import { applyDashboardSpec } from '../actions/dashboard/applyDashboardSpec';
import { type DashboardScene } from '../scene/DashboardScene';

import { type SchemaEditorFormat } from '../v2schema/DashboardSchemaEditor';

import { buildDashboardResource, validateDashboardResourceEnvelope } from './dashboardResource';

function serializeResource(resource: unknown, format: SchemaEditorFormat): string {
  if (format === 'yaml') {
    return yaml.dump(resource, { indent: 2, lineWidth: -1, noRefs: true });
  }
  return JSON.stringify(resource, null, 2);
}

export function getDashboardResourceText(dashboard: DashboardScene, format: SchemaEditorFormat = 'json'): string {
  return serializeResource(buildDashboardResource(dashboard), format);
}

/**
 * Builds both sides of the code pane diff view: the dashboard as it was loaded or last saved vs
 * the current editor content. Both sides are normalized (sorted keys, nulls stripped) so that
 * serialization order doesn't produce phantom diffs. Returns null when there is no initial save
 * model to compare against, when a v1 save model can't be converted, or when the editor content
 * isn't parseable JSON.
 */
export function getDashboardDiffTexts(
  dashboard: DashboardScene,
  currentJsonText: string,
  format: SchemaEditorFormat = 'json'
): { original: string; current: string; migratedFromV1: boolean } | null {
  const initialSaveModel = dashboard.getInitialSaveModel();
  if (!initialSaveModel) {
    return null;
  }

  const originalSpec = isDashboardV2Spec(initialSaveModel)
    ? initialSaveModel
    : convertInitialSaveModelToV2(dashboard, initialSaveModel);
  if (!originalSpec) {
    return null;
  }

  let current: unknown;
  try {
    current = JSON.parse(currentJsonText);
  } catch {
    return null;
  }

  return {
    original: serializeResource(sortedDeepCloneWithoutNulls(buildDashboardResource(dashboard, originalSpec)), format),
    current: serializeResource(sortedDeepCloneWithoutNulls(current), format),
    // The v1->v2 conversion does not produce the exact spec the scene serializer emits, so a
    // migrated diff contains changes the user did not make - consumers show a notice for it.
    migratedFromV1: !isDashboardV2Spec(initialSaveModel),
  };
}

// The code pane always renders the current scene as a v2 resource, but the dashboard may have
// been loaded through the v1/unified API (getDashboardsApiVersion returns v2 only with
// dashboardNewLayouts or an explicit v2 request). Those dashboards have a v1 initial save model,
// which must be converted so both diff sides use the same schema version.
function convertInitialSaveModelToV2(dashboard: DashboardScene, initialSaveModel: Dashboard): DashboardV2Spec | null {
  try {
    const dashboardData: DashboardDataDTO = {
      ...initialSaveModel,
      title: initialSaveModel.title ?? '',
      uid: initialSaveModel.uid ?? dashboard.state.uid ?? '',
    };
    return ensureV2Response({ dashboard: dashboardData, meta: dashboard.state.meta }).spec;
  } catch {
    return null;
  }
}


export function applyJsonToDashboard(
  dashboard: DashboardScene,
  jsonText: string
): { success: boolean; error?: string } {
  try {
    const resource = JSON.parse(jsonText);
    const { spec } = resource;

    const validation = validateDashboardResourceEnvelope(dashboard, resource);
    if (!validation.success) {
      return validation;
    }

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    applyDashboardSpec({
      scene: dashboard,
      spec,
      description: t('dashboard.sidebar.edit-schema.undo-title', 'Schema edit'),
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
