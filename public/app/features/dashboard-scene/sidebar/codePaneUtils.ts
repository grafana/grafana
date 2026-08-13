import yaml from 'js-yaml';

import { t } from '@grafana/i18n';
import { sceneUtils } from '@grafana/scenes';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { ensureV2Response } from '../../dashboard/api/ResponseTransformers';
import { type DashboardWithAccessInfo } from '../../dashboard/api/types';
import { isDashboardV2Spec } from '../../dashboard/api/utils';
import { getK8sV2DashboardApiConfig } from '../../dashboard/api/v2';
import { type DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { type SchemaEditorFormat } from '../v2schema/DashboardSchemaEditor';

import { DashboardEditActionEvent, DashboardStateChangedEvent } from './events';

const NEW_DASHBOARD_NAME_PLACEHOLDER = '<dashboard-uid>';

function buildDashboardResource(dashboard: DashboardScene, spec: DashboardV2Spec) {
  const { group, version } = getK8sV2DashboardApiConfig();
  return {
    apiVersion: `${group}/${version}`,
    kind: 'Dashboard',
    metadata: {
      name: dashboard.state.uid ?? NEW_DASHBOARD_NAME_PLACEHOLDER,
    },
    spec,
  };
}

function serializeResource(resource: unknown, format: SchemaEditorFormat): string {
  if (format === 'yaml') {
    return yaml.dump(resource, { indent: 2, lineWidth: -1, noRefs: true });
  }
  return JSON.stringify(resource, null, 2);
}

export function getDashboardResourceText(dashboard: DashboardScene, format: SchemaEditorFormat = 'json'): string {
  return serializeResource(buildDashboardResource(dashboard, transformSceneToSaveModelSchemaV2(dashboard)), format);
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

// Only spec edits are supported from the resource JSON editors. Validate the envelope so that
// changes to apiVersion, kind, or metadata fail loudly instead of being silently dropped.
export function validateDashboardResourceEnvelope(
  dashboard: DashboardScene,
  resource: {
    apiVersion?: string;
    kind?: string;
    spec?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
): { success: boolean; error?: string } {
  const expectedAPIVersion = `dashboard.grafana.app/${getK8sV2DashboardApiConfig().version}`;
  const { apiVersion, kind, spec, metadata } = resource;

  if (!spec) {
    return {
      success: false,
      error: t('dashboard.schema-editor.missing-spec', 'Missing spec. Expected a valid dashboard spec.'),
    };
  }
  if (kind && kind !== 'Dashboard') {
    return {
      success: false,
      error: t('dashboard.schema-editor.invalid-kind', "Invalid kind: {{kind}}. Expected 'Dashboard'.", { kind }),
    };
  }
  if (apiVersion && apiVersion !== expectedAPIVersion) {
    return {
      success: false,
      error: t(
        'dashboard.schema-editor.invalid-api-version',
        "Invalid apiVersion: {{apiVersion}}. Expected '{{expectedAPIVersion}}'.",
        { apiVersion, expectedAPIVersion }
      ),
    };
  }
  // getDashboardResourceText() emits NEW_DASHBOARD_NAME_PLACEHOLDER when the dashboard has no uid yet,
  // so the editor's own initial JSON must be accepted.
  const expectedName = dashboard.state.uid ?? NEW_DASHBOARD_NAME_PLACEHOLDER;
  if (metadata?.name && metadata.name !== expectedName) {
    return {
      success: false,
      error: t('dashboard.schema-editor.identifier-change-unsupported', 'Unable to change identifier from JSON editor'),
    };
  }
  // Only metadata.name is honored when building the DTO; reject any other field so
  // unsupported metadata edits (e.g. labels) fail loudly rather than being silently dropped.
  const unsupportedMetadataKeys = Object.keys(metadata ?? {}).filter((key) => key !== 'name');
  if (unsupportedMetadataKeys.length > 0) {
    return {
      success: false,
      error: t(
        'dashboard.schema-editor.metadata-edit-unsupported',
        'Editing dashboard metadata is not yet supported ({{keys}})',
        { keys: unsupportedMetadataKeys.join(', ') }
      ),
    };
  }
  return { success: true };
}

export function applyJsonToDashboard(
  dashboard: DashboardScene,
  jsonText: string
): { success: boolean; error?: string } {
  try {
    const expectedAPIVersion = `dashboard.grafana.app/${getK8sV2DashboardApiConfig().version}`;
    const resource = JSON.parse(jsonText);
    const { spec } = resource;

    const validation = validateDashboardResourceEnvelope(dashboard, resource);
    if (!validation.success) {
      return validation;
    }

    const { meta } = dashboard.state;
    const dto: DashboardWithAccessInfo<DashboardV2Spec> = {
      apiVersion: expectedAPIVersion,
      kind: 'DashboardWithAccessInfo',
      metadata: {
        name: dashboard.state.uid ?? '',
        resourceVersion: '',
        creationTimestamp: '',
        ...dashboard.serializer.metadata,
      },
      spec,
      access: {
        canSave: meta.canSave,
        canEdit: meta.canEdit,
        canAdmin: meta.canAdmin,
        canStar: meta.canStar,
        canDelete: meta.canDelete,
        canShare: meta.canShare,
        annotationsPermissions: meta.annotationsPermissions,
        url: meta.url,
        slug: meta.slug,
      },
    };

    const previousState = sceneUtils.cloneSceneObjectState(dashboard.state);
    const newDashboardScene = transformSaveModelSchemaV2ToScene(dto);
    const newState = sceneUtils.cloneSceneObjectState(newDashboardScene.state, { key: dashboard.state.key });

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    dashboard.setState({ ...newState, isDirty: true });

    dashboard.publishEvent(
      new DashboardEditActionEvent({
        source: dashboard,
        description: t('dashboard.sidebar.edit-schema.undo-title', 'Schema edit'),
        perform: () => dashboard.setState(newState),
        undo: () => dashboard.setState(previousState),
      }),
      true
    );
    dashboard.publishEvent(new DashboardStateChangedEvent({ source: dashboard }), true);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
