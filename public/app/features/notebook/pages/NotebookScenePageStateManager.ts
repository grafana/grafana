import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { type Resource } from 'app/features/apiserver/types';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import {
  DashboardScenePageStateManagerV2,
  type LoadDashboardOptions,
} from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { NotebookLayoutManager } from 'app/features/dashboard-scene/scene/layout-notebook/NotebookLayoutManager';
import { dispatch } from 'app/store/store';

import { buildNotebookEnvelope } from '../scene/buildNotebookEnvelope';

// A notebook renders through the same scene pipeline as a v2 dashboard, so we reuse
// the v2 state manager wholesale (loading/error/caching/transform) and only swap the
// fetch: a notebook comes from the notebooks resource and is wrapped into the scene
// envelope. The inherited loadDashboard catches a failed fetch/transform into loadError
// (the page's error state).
export class NotebookScenePageStateManager extends DashboardScenePageStateManagerV2 {
  public async fetchDashboard(options: LoadDashboardOptions): Promise<DashboardWithAccessInfo<DashboardV2Spec> | null> {
    if (!options.uid) {
      return null;
    }

    // The notebook is a sibling resource in the dashboard API group, so it is fetched via
    // the generated RTK client's getNotebook endpoint (same imperative-dispatch pattern the
    // base state manager uses for provisioning). initiate() returns { data } or { error }.
    // subscribe: false makes this a one-shot loader fetch that does not leave a cache
    // subscription open for every notebook opened during the session.
    const result = await dispatch(
      dashboardAPIv2beta1.endpoints.getNotebook.initiate({ name: options.uid }, { subscribe: false })
    );
    if (result && 'error' in result) {
      throw result.error;
    }

    // No data means show an error, not crash on notebook.spec below.
    if (!result.data) {
      throw new Error('Notebook not found');
    }

    // The generated Notebook mirrors the apiserver Resource<NotebookSpec> at runtime (both
    // come from the same OpenAPI source); cast at this seam so the envelope and render layer
    // stay on the @grafana/schema notebook types.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the schema resource type at the fetch seam
    const notebook = result.data as unknown as Resource<NotebookSpec>;
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

    // Surface the notebook's title and tags on the layout manager's own state so its header can
    // show them. The manager deliberately doesn't read them off the DashboardScene (that import
    // would form a dependency cycle), so the loader pushes them down here.
    const body = scene?.state.body;
    if (body instanceof NotebookLayoutManager) {
      body.setState({ title: rsp?.spec.title, tags: rsp?.spec.tags });
    }

    return scene;
  }
}

let notebookScenePageStateManager: NotebookScenePageStateManager | undefined;

// Shared, lazily-created once per app load (mirrors getDashboardScenePageStateManager). A page
// component should not `new` this on every mount: a module-level singleton avoids re-init on
// remount and lets the loading/caching state survive navigations.
export function getNotebookScenePageStateManager(): NotebookScenePageStateManager {
  if (!notebookScenePageStateManager) {
    notebookScenePageStateManager = new NotebookScenePageStateManager({});
  }

  return notebookScenePageStateManager;
}
