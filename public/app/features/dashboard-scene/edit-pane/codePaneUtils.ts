import yaml from 'js-yaml';

import { t } from '@grafana/i18n';
import { sceneUtils } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type DashboardWithAccessInfo } from '../../dashboard/api/types';
import { getK8sV2DashboardApiConfig } from '../../dashboard/api/v2';
import { type DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { type SchemaEditorFormat } from '../v2schema/DashboardSchemaEditor';

import { DashboardEditActionEvent, DashboardStateChangedEvent } from './events';

export function getDashboardJsonText(dashboard: DashboardScene): string {
  return JSON.stringify(transformSceneToSaveModelSchemaV2(dashboard), null, 2);
}

const NEW_DASHBOARD_NAME_PLACEHOLDER = '<dashboard-uid>';

export function getDashboardResourceText(dashboard: DashboardScene, format: SchemaEditorFormat = 'json'): string {
  const spec = transformSceneToSaveModelSchemaV2(dashboard);
  const { group, version } = getK8sV2DashboardApiConfig();
  const resource = {
    apiVersion: `${group}/${version}`,
    kind: 'Dashboard',
    metadata: {
      name: dashboard.state.uid ?? NEW_DASHBOARD_NAME_PLACEHOLDER,
    },
    spec,
  };

  if (format === 'yaml') {
    return yaml.dump(resource, { indent: 2, lineWidth: -1, noRefs: true });
  }
  return JSON.stringify(resource, null, 2);
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
