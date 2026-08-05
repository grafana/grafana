import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { type Resource } from 'app/features/apiserver/types';
import { dispatch } from 'app/store/store';

import { type NotebookScene } from '../scene/NotebookScene';
import { transformNotebookToScene } from '../serialization/transformNotebookToScene';

export interface NotebookPageState {
  scene?: NotebookScene;
  isLoading: boolean;
  loadError?: Error;
}

/**
 * Loads a Notebook resource and builds its scene. Deliberately independent of the dashboard page
 * state managers: inheriting DashboardScenePageStateManagerV2 made every notebook open emit
 * dashboard analytics (DashboardView meta-analytics, dashboardInitialized, the dashboard_view
 * query profile) and forced the notebook through the dashboard envelope/transform.
 */
export class NotebookPageStateManager extends StateManagerBase<NotebookPageState> {
  // Scene cache so navigating away and back doesn't rebuild (and re-run) the whole document.
  // Invalidated by resource generation, so a save elsewhere produces a fresh scene.
  private cache = new Map<string, { generation?: number; scene: NotebookScene }>();

  public async loadNotebook(uid: string): Promise<void> {
    this.setState({ isLoading: true, loadError: undefined });

    try {
      // One-shot loader fetch (same imperative-dispatch pattern the dashboard loaders use);
      // subscribe: false avoids leaving an RTK cache subscription open per opened notebook.
      const result = await dispatch(
        dashboardAPIv2beta1.endpoints.getNotebook.initiate({ name: uid }, { subscribe: false })
      );

      if (result && 'error' in result) {
        throw result.error;
      }

      if (!result.data) {
        throw new Error('Notebook not found');
      }

      // The generated client type mirrors the apiserver Resource<NotebookSpec> at runtime (same
      // OpenAPI source); bridge at the fetch seam so everything downstream uses the schema types.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the schema resource type at the fetch seam
      const notebook = result.data as unknown as Resource<NotebookSpec>;

      const cached = this.cache.get(uid);
      if (cached && cached.generation === notebook.metadata.generation) {
        this.setState({ scene: cached.scene, isLoading: false });
        return;
      }

      // RTK Query freezes cached responses (Immer). The scene pipeline mutates nested panel
      // fieldConfig (e.g. threshold base → -Infinity), so clone before transforming.
      const scene = transformNotebookToScene(structuredClone(notebook));

      this.cache.set(uid, { generation: notebook.metadata.generation, scene });
      this.setState({ scene, isLoading: false });
    } catch (error) {
      this.setState({
        isLoading: false,
        loadError: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  public clearState(): void {
    this.setState({ scene: undefined, isLoading: false, loadError: undefined });
  }
}

let notebookPageStateManager: NotebookPageStateManager | undefined;

// Shared, lazily-created once per app load. A page component should not `new` this on every
// mount: the module-level singleton lets the scene cache survive navigations.
export function getNotebookPageStateManager(): NotebookPageStateManager {
  if (!notebookPageStateManager) {
    notebookPageStateManager = new NotebookPageStateManager({ isLoading: false });
  }

  return notebookPageStateManager;
}
