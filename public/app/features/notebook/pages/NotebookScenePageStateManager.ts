import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import {
  DashboardScenePageStateManagerV2,
  type LoadDashboardOptions,
} from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { K8sNotebookAPI } from '../api/NotebookAPI';
import { buildNotebookEnvelope } from '../scene/buildNotebookEnvelope';

// A notebook renders through the same scene pipeline as a v2 dashboard, so we reuse
// the v2 state manager wholesale (loading/error/caching/transform) and only swap the
// fetch: a notebook comes from the notebooks resource and is wrapped into the scene
// envelope. Until F7 registers the NotebookLayout deserializer the transform throws,
// and the inherited loadDashboard catches it into loadError (the page's error state).
export class NotebookScenePageStateManager extends DashboardScenePageStateManagerV2 {
  private notebookApi = new K8sNotebookAPI();

  public async fetchDashboard(options: LoadDashboardOptions): Promise<DashboardWithAccessInfo<DashboardV2Spec> | null> {
    if (!options.uid) {
      return null;
    }

    const notebook = await this.notebookApi.getNotebook(options.uid);
    return buildNotebookEnvelope(notebook);
  }

  public transformResponseToScene(
    rsp: DashboardWithAccessInfo<DashboardV2Spec> | null,
    options: LoadDashboardOptions
  ): DashboardScene | null {
    const scene = super.transformResponseToScene(rsp, options);
    // The POC notebook is read-only. Marking the scene as embedded hides the dashboard
    // edit/share/export toolbar actions and the outline/edit pane (canEditDashboard() and
    // the share button both require !isEmbedded) while the page + title still render.
    scene?.setState({ meta: { ...scene.state.meta, isEmbedded: true } });
    return scene;
  }
}
