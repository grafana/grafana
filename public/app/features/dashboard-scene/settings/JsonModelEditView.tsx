import { lazy, Suspense } from 'react';

import { type SceneComponentProps, sceneGraph, SceneObjectBase, sceneUtils } from '@grafana/scenes';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Spinner } from '@grafana/ui';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { getPrettyJSON } from 'app/features/inspector/utils/utils';
import { type DashboardDataDTO, type SaveDashboardResponseDTO } from 'app/types/dashboard';

import { type DashboardScene } from '../scene/DashboardScene';
import { type DashboardSceneState } from '../scene/types/dashboard';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { getDashboardResourceText, validateDashboardResourceEnvelope } from '../sidebar/codePaneUtils';
import { getDashboardSceneFor } from '../utils/utils';

import { type DashboardEditView, type DashboardEditViewState } from './utils';

const JsonModelEditViewRenderer = lazy(() =>
  import('./SettingsRenderers').then((m) => ({ default: m.JsonModelEditViewRenderer }))
);

function LazyJsonModelEditViewRenderer(props: SceneComponentProps<JsonModelEditView>) {
  return (
    <Suspense fallback={<Spinner />}>
      <JsonModelEditViewRenderer {...props} />
    </Suspense>
  );
}

export interface JsonModelEditViewState extends DashboardEditViewState {
  jsonText: string;
}

export class JsonModelEditView extends SceneObjectBase<JsonModelEditViewState> implements DashboardEditView {
  constructor(state: Omit<JsonModelEditViewState, 'jsonText' | 'initialJsonText'>) {
    super({
      ...state,
      jsonText: '',
    });

    this.addActivationHandler(() => this.setState({ jsonText: this.getJsonText() }));
  }
  public getUrlKey(): string {
    return 'json-model';
  }

  public getDashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getSaveModel(): Dashboard | DashboardV2Spec {
    return this.getDashboard().getSaveModel();
  }

  public getJsonText(): string {
    const jsonData = this.getSaveModel();
    // v2 dashboards are edited as the full resource envelope (apiVersion, kind, metadata, spec)
    // so the editor validates against the same resource schema used elsewhere.
    if (isDashboardV2Spec(jsonData)) {
      return getDashboardResourceText(this.getDashboard());
    }
    return getPrettyJSON(jsonData);
  }

  // Inverse of getJsonText(): unwrap the v2 resource envelope back to the bare spec used by the save flow.
  public getEditedSaveModel(): DashboardDataDTO | DashboardV2Spec {
    const parsed = JSON.parse(this.state.jsonText);
    return isDashboardV2Spec(this.getSaveModel()) ? parsed.spec : parsed;
  }

  // v2 dashboards are edited as the full resource envelope but only spec edits are supported.
  // Validate the envelope before saving so metadata/kind/apiVersion changes fail loudly rather
  // than being silently dropped by getEditedSaveModel() (consistent with the sidebar code editor).
  public validateEditedResource(): { success: boolean; error?: string } {
    if (!isDashboardV2Spec(this.getSaveModel())) {
      return { success: true };
    }
    let resource;
    try {
      resource = JSON.parse(this.state.jsonText);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Invalid JSON' };
    }
    return validateDashboardResourceEnvelope(this.getDashboard(), resource);
  }

  public onCodeEditorBlur = (value: string) => {
    this.setState({ jsonText: value });
  };

  public onSaveSuccess = async (result: SaveDashboardResponseDTO) => {
    const jsonModel = this.getEditedSaveModel();
    const dashboard = this.getDashboard();

    const isV2 = isDashboardV2Spec(jsonModel);
    let newDashboardScene: DashboardScene;

    if (isV2) {
      // FIXME: We could avoid this call by storing the entire dashboard DTO as initial dashboard scene instead of only the spec and metadata
      const api = await getDashboardAPI('v2');
      const dto = await api.getDashboardDTO(result.uid);
      newDashboardScene = transformSaveModelSchemaV2ToScene(dto);
      const { isOverlayLoading, ...newState } = sceneUtils.cloneSceneObjectState(newDashboardScene.state, {
        key: dashboard.state.key,
      });

      dashboard.pauseTrackingChanges();
      dashboard.setInitialSaveModel(dto.spec, dto.metadata);
      this._updateTimeRangeInURL(dashboard, newState);

      dashboard.setState(newState);
    } else {
      jsonModel.version = result.version;
      newDashboardScene = transformSaveModelToScene({
        dashboard: jsonModel,
        meta: dashboard.state.meta,
      });

      const { isOverlayLoading, ...newState } = sceneUtils.cloneSceneObjectState(newDashboardScene.state, {
        key: dashboard.state.key,
      });

      dashboard.pauseTrackingChanges();
      dashboard.setInitialSaveModel(jsonModel, dashboard.state.meta);

      this._updateTimeRangeInURL(dashboard, newState);

      dashboard.setState(newState);
    }

    this.setState({ jsonText: this.getJsonText() });

    // We also need to resume tracking changes since the change handler won't see any later edit
    dashboard.resumeTrackingChanges();
  };

  private _updateTimeRangeInURL(dashboard: DashboardScene, newState: DashboardSceneState) {
    const oldFrom = dashboard.state.$timeRange?.state.from;
    const oldTo = dashboard.state.$timeRange?.state.to;

    const nextFrom = newState.$timeRange?.state.from;
    const nextTo = newState.$timeRange?.state.to;
    const nextRangeValue = newState.$timeRange?.state.value;

    if (nextFrom && nextTo && nextRangeValue && (oldFrom !== nextFrom || oldTo !== nextTo)) {
      const timeRange = sceneGraph.getTimeRange(this);
      timeRange.onTimeRangeChange(nextRangeValue);
    }
  }

  static Component = LazyJsonModelEditViewRenderer;
}
