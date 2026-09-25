import { t } from '@grafana/i18n';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { getK8sV2DashboardApiConfig } from '../../dashboard/api/v2';
import { type DashboardScene } from '../scene/DashboardScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';

const NEW_DASHBOARD_NAME_PLACEHOLDER = '<dashboard-uid>';

export function buildDashboardResource(
  dashboard: DashboardScene,
  spec: DashboardV2Spec = transformSceneToSaveModelSchemaV2(dashboard)
) {
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
  const { group, version } = getK8sV2DashboardApiConfig();
  const expectedAPIVersion = `${group}/${version}`;
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
  // Resources for unsaved dashboards use a placeholder name, which must also pass validation.
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
