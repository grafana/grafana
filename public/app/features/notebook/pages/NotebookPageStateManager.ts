import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { getMessageFromError, getMessageIdFromError, getStatusFromError } from 'app/core/utils/errors';
import { type Resource } from 'app/features/apiserver/types';
import { dispatch } from 'app/store/store';

import { type NotebookScene } from '../scene/NotebookScene';
import { transformNotebookToScene } from '../serialization/transformNotebookToScene';

/**
 * A load failure normalized to the fields the error UI needs. RTK rejects with `{ status, data }`
 * rather than an Error, so the raw value must be normalized here — coercing it to an Error would
 * drop the HTTP status (no 404 not-found state) and stringify the body to "[object Object]".
 */
export interface NotebookLoadError {
  status?: number;
  messageId?: string;
  message: string;
}

export interface NotebookPageState {
  scene?: NotebookScene;
  isLoading: boolean;
  loadError?: NotebookLoadError;
}

/**
 * Loads a Notebook resource and builds its scene. Deliberately independent of the dashboard page
 * state managers: inheriting DashboardScenePageStateManagerV2 made every notebook open emit
 * dashboard analytics (DashboardView meta-analytics, dashboardInitialized, the dashboard_view
 * query profile) and forced the notebook through the dashboard envelope/transform.
 */
export class NotebookPageStateManager extends StateManagerBase<NotebookPageState> {
  private cache = new Map<string, { generation?: number; scene: NotebookScene }>();

  // Identifies the load the page currently wants. `await` does not cancel, so a load started for an
  // earlier request still resumes and would write over a newer one — the page renders whatever is in
  // this singleton, with nothing tying that to the route. Navigating A -> B while A is in flight would
  // otherwise leave B's URL showing A, and it would stick, because nothing fires afterwards.
  //
  // A counter rather than the requested uid, so two loads of the *same* notebook are distinguishable
  // too: clearState() followed by a re-request of the same uid would otherwise let the abandoned load
  // through, because its uid matches again. That case is currently unobservable — RTK Query collapses
  // concurrent initiate() calls sharing a cache key into one request, so both loads see the same
  // outcome — but the counter is correct by construction and does not depend on that.
  private requestSeq = 0;

  public async loadNotebook(uid: string): Promise<void> {
    const seq = ++this.requestSeq;
    this.setState({ isLoading: true, loadError: undefined });

    try {
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
        if (this.isSuperseded(seq)) {
          return;
        }
        this.setState({ scene: cached.scene, isLoading: false });
        return;
      }

      // RTK Query freezes cached responses (Immer). The scene pipeline mutates nested panel
      // fieldConfig (e.g. threshold base → -Infinity), so clone before transforming.
      const scene = transformNotebookToScene(structuredClone(notebook));

      // Cache even when superseded: the work is already paid for, so a later visit to this uid can
      // reuse it. Only the state write has to be suppressed.
      this.cache.set(uid, { generation: notebook.metadata.generation, scene });

      if (this.isSuperseded(seq)) {
        return;
      }
      this.setState({ scene, isLoading: false });
    } catch (error) {
      // A superseded failure must not surface either, or a stale 404 would replace the notebook the
      // page has already loaded.
      if (this.isSuperseded(seq)) {
        return;
      }

      this.setState({
        isLoading: false,
        loadError: {
          status: getStatusFromError(error),
          message: getMessageFromError(error),
          messageId: getMessageIdFromError(error),
        },
      });
    }
  }

  /** Whether a newer load (or a page teardown) has taken over since the given one started. */
  private isSuperseded(seq: number): boolean {
    return seq !== this.requestSeq;
  }

  public clearState(): void {
    // Bumping the counter discards anything in flight: without it a load that resolves after the page
    // is gone repopulates the singleton, and the next notebook opened flashes the previous one first.
    this.requestSeq++;
    this.setState({ scene: undefined, isLoading: false, loadError: undefined });
  }

  public removeSceneCache(uid: string): void {
    this.cache.delete(uid);
  }

  public clearSceneCache(): void {
    this.cache.clear();
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
