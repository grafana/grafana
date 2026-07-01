import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import {
  DashboardScenePageStateManagerV2,
  type LoadDashboardOptions,
} from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';

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
}
