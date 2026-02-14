import { t } from '@grafana/i18n';
import { sceneUtils } from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { DashboardWithAccessInfo } from '../../dashboard/api/types';
import { DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';

import { DashboardEditActionEvent, DashboardStateChangedEvent } from './events';

export function getDashboardJsonText(dashboard: DashboardScene): string {
  return JSON.stringify(transformSceneToSaveModelSchemaV2(dashboard), null, 2);
}

export function applyJsonToDashboard(
  dashboard: DashboardScene,
  jsonText: string
): { success: boolean; error?: string } {
  try {
    const spec = JSON.parse(jsonText);
    const { meta } = dashboard.state;

    const dto: DashboardWithAccessInfo<DashboardV2Spec> = {
      apiVersion: 'v2beta1',
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
