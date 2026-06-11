import yaml from 'js-yaml';

import { t } from '@grafana/i18n';
import { sceneUtils } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type DashboardWithAccessInfo } from '../../dashboard/api/types';
import { getK8sV2DashboardApiConfig } from '../../dashboard/api/v2';
import { type DashboardScene } from '../scene/DashboardScene';
import { makeExportableV2, stripMetadataForExport } from '../scene/export/exporters';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { type ExportableResource } from '../sharing/ShareExportTab';
import { type SchemaEditorFormat } from '../v2schema/DashboardSchemaEditor';

import { DashboardEditActionEvent, DashboardStateChangedEvent } from './events';

export function getDashboardJsonText(dashboard: DashboardScene): string {
  return JSON.stringify(transformSceneToSaveModelSchemaV2(dashboard), null, 2);
}

// Converts the canonical JSON editor content into the currently selected editor format.
export function formatForEditor(jsonText: string, format: SchemaEditorFormat): string {
  if (format === 'yaml') {
    return yaml.dump(JSON.parse(jsonText));
  }
  return jsonText;
}

// Builds the external-sharing envelope, matching the format produced by
// "Share dashboard with another instance" in the export drawer.
export async function buildSharingExport(dashboard: DashboardScene, jsonText: string): Promise<ExportableResource> {
  const spec: DashboardV2Spec = JSON.parse(jsonText);
  const exportedSpec = await makeExportableV2(spec, true);

  return {
    apiVersion: getK8sV2DashboardApiConfig().version,
    kind: 'Dashboard',
    metadata: stripMetadataForExport(
      {
        name: dashboard.state.uid ?? '',
        resourceVersion: '',
        creationTimestamp: '',
        ...dashboard.serializer.metadata,
      },
      true
    ),
    spec: exportedSpec,
  };
}

// Serializes the external-sharing envelope into the currently selected editor format.
export async function getSharingExportText(
  dashboard: DashboardScene,
  jsonText: string,
  format: SchemaEditorFormat
): Promise<string> {
  const envelope = await buildSharingExport(dashboard, jsonText);
  return format === 'yaml' ? yaml.dump(envelope) : JSON.stringify(envelope, null, 2);
}

export function applyJsonToDashboard(
  dashboard: DashboardScene,
  jsonText: string
): { success: boolean; error?: string } {
  try {
    const spec = JSON.parse(jsonText);
    const { meta } = dashboard.state;

    const dto: DashboardWithAccessInfo<DashboardV2Spec> = {
      apiVersion: getK8sV2DashboardApiConfig().version,
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
        description: t('dashboard.schema-editor.undo-title', 'Schema edit'),
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
