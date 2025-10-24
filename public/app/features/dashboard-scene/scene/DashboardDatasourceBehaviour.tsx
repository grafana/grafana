import { Unsubscribable } from 'rxjs';

import { SceneDataTransformer, SceneObjectBase, SceneObjectState, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import {
  findVizPanelByKey,
  getDashboardSceneFor,
  getLibraryPanelBehavior,
  getQueryRunnerFor,
  getVizPanelKeyForPanelId,
} from '../utils/utils';

import { DashboardScene } from './DashboardScene';
import { LibraryPanelBehaviorState } from './LibraryPanelBehavior';

interface DashboardDatasourceBehaviourState extends SceneObjectState {}

export class DashboardDatasourceBehaviour extends SceneObjectBase<DashboardDatasourceBehaviourState> {
  private prevRequestId: string | undefined;
  private prevRequestIds: Map<number, string> = new Map();
  public constructor(state: DashboardDatasourceBehaviourState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    const queryRunner = this.parent;
    let dashboard: DashboardScene;

    if (!(queryRunner instanceof SceneQueryRunner)) {
      throw new Error('DashboardDatasourceBehaviour must be attached to a SceneQueryRunner');
    }

    if (!this.containsDashboardDSQueries(queryRunner)) {
      return;
    }

    try {
      dashboard = getDashboardSceneFor(queryRunner);
    } catch {
      return;
    }

    /** Get all "Dashboard datasource" queries
     * panelId prop is the way we identify Dashboard datasource queries
     *   {
     *    datasource: { uid: "-- Dashboard --" },
     *    panelId: 12,  // ← Points to panel 12
     *    refId: "A"
     *   }
     */
    const dashboardDsQueries = queryRunner.state.queries.filter((query) => query.panelId !== undefined);

    if (dashboardDsQueries.length === 0) {
      return;
    }

    // Single query: use original logic with prevRequestId tracking
    if (dashboardDsQueries.length === 1) {
      return this._handleSingleQuery(dashboardDsQueries[0], queryRunner, dashboard);
    }

    // Multiple queries: use new logic to track all library panels (bug fix for mixed datasource)
    return this._handleMultipleQueries(dashboardDsQueries, queryRunner, dashboard);
  }

  /**
   * Original logic for handling a single dashboard datasource query.
   * Preserves prevRequestId tracking for efficiency.
   */
  private _handleSingleQuery(
    dashboardQuery: { panelId?: number; [key: string]: unknown },
    queryRunner: SceneQueryRunner,
    dashboard: DashboardScene
  ): (() => void) | undefined {
    let libraryPanelSub: Unsubscribable;
    let transformerSub: Unsubscribable;

    const panelId = dashboardQuery.panelId;
    if (panelId === undefined) {
      return;
    }

    const vizKey = getVizPanelKeyForPanelId(panelId);
    const sourcePanel = findVizPanelByKey(dashboard, vizKey);

    if (!(sourcePanel instanceof VizPanel)) {
      return;
    }

    //check if the source panel is a library panel and wait for it to load
    const libraryPanelBehaviour = getLibraryPanelBehavior(sourcePanel);
    if (libraryPanelBehaviour && !libraryPanelBehaviour.state.isLoaded) {
      libraryPanelSub = libraryPanelBehaviour.subscribeToState((newLibPanel) => {
        this.handleLibPanelStateUpdates(newLibPanel, queryRunner, sourcePanel);
      });
      return () => {
        if (libraryPanelSub) {
          libraryPanelSub.unsubscribe();
        }
      };
    }

    const sourcePanelQueryRunner = getQueryRunnerFor(sourcePanel);

    if (!sourcePanelQueryRunner) {
      throw new Error('Could not find SceneQueryRunner for panel');
    }

    const dataTransformer = sourcePanelQueryRunner.parent;

    if (dataTransformer instanceof SceneDataTransformer && dataTransformer.state.transformations.length) {
      // in mixed DS scenario we complete the observable and merge data, so on a variable change
      // the data transformer will emit but there will be no subscription and thus not visual update
      // on the panel. Similar thing happens when going to edit mode and back, where we unsubscribe and
      // since we never re-run the query, only reprocess the transformations, the panel will not update.
      transformerSub = dataTransformer.subscribeToState((newState, oldState) => {
        if (newState.data !== oldState.data) {
          queryRunner.runQueries();
        }
      });
    }

    if (this.prevRequestId && this.prevRequestId !== sourcePanelQueryRunner.state.data?.request?.requestId) {
      queryRunner.runQueries();
    }

    return () => {
      this.prevRequestId = sourcePanelQueryRunner?.state.data?.request?.requestId;
      if (libraryPanelSub) {
        libraryPanelSub.unsubscribe();
      }

      if (transformerSub) {
        transformerSub.unsubscribe();
      }
    };
  }

  /**
   * New logic for handling multiple dashboard datasource queries.
   * This fixes the bug where only the first panel was tracked when using mixed datasource missing queries that could
   * contain library panels.
   */
  private _handleMultipleQueries(
    dashboardQueries: Array<{ panelId?: number; [key: string]: unknown }>,
    queryRunner: SceneQueryRunner,
    dashboard: DashboardScene
  ): () => void {
    const libraryPanelSubs: Unsubscribable[] = [];
    const transformerSubs: Unsubscribable[] = [];
    let shouldRunQueries = false;

    // Loop through ALL dashboard queries to track each panel
    for (const dashboardQuery of dashboardQueries) {
      const panelId = dashboardQuery.panelId;
      if (panelId === undefined) {
        continue;
      }

      const vizKey = getVizPanelKeyForPanelId(panelId);
      const sourcePanel = findVizPanelByKey(dashboard, vizKey);

      if (!(sourcePanel instanceof VizPanel)) {
        continue;
      }

      // Check if the source panel is a library panel and wait for it to load
      const libraryPanelBehaviour = getLibraryPanelBehavior(sourcePanel);

      if (libraryPanelBehaviour && !libraryPanelBehaviour.state.isLoaded) {
        const sub = libraryPanelBehaviour.subscribeToState((newLibPanel) => {
          this.handleLibPanelStateUpdates(newLibPanel, queryRunner, sourcePanel);
        });
        libraryPanelSubs.push(sub);
        continue; // Don't process transformers until library panel is loaded
      }

      // Subscribe to transformer changes for this panel
      const sourcePanelQueryRunner = getQueryRunnerFor(sourcePanel);

      if (!sourcePanelQueryRunner) {
        continue; // Skip panels without query runners instead of throwing
      }

      // Check if this panel's requestId changed since last activation
      const currentRequestId = sourcePanelQueryRunner.state.data?.request?.requestId;
      const prevRequestId = this.prevRequestIds.get(panelId);

      if (prevRequestId && currentRequestId && prevRequestId !== currentRequestId) {
        shouldRunQueries = true;
      }

      const dataTransformer = sourcePanelQueryRunner.parent;

      if (dataTransformer instanceof SceneDataTransformer && dataTransformer.state.transformations.length) {
        const transformerSub = dataTransformer.subscribeToState((newState, oldState) => {
          if (newState.data !== oldState.data) {
            queryRunner.runQueries();
          }
        });
        transformerSubs.push(transformerSub);
      }
    }

    // If any panel's data changed since last activation, run queries
    if (shouldRunQueries) {
      queryRunner.runQueries();
    }

    // Return cleanup function that unsubscribes from ALL subscriptions
    return () => {
      // Store all current requestIds before cleanup
      for (const dashboardQuery of dashboardQueries) {
        const panelId = dashboardQuery.panelId;
        if (panelId === undefined) {
          continue;
        }

        const vizKey = getVizPanelKeyForPanelId(panelId);
        const sourcePanel = findVizPanelByKey(dashboard, vizKey);

        if (!(sourcePanel instanceof VizPanel)) {
          continue;
        }

        const sourcePanelQueryRunner = getQueryRunnerFor(sourcePanel);
        const requestId = sourcePanelQueryRunner?.state.data?.request?.requestId;

        if (requestId) {
          this.prevRequestIds.set(panelId, requestId);
        }
      }

      libraryPanelSubs.forEach((sub) => sub.unsubscribe());
      transformerSubs.forEach((sub) => sub.unsubscribe());
    };
  }

  private containsDashboardDSQueries(queryRunner: SceneQueryRunner): boolean {
    if (queryRunner.state.datasource?.uid === SHARED_DASHBOARD_QUERY) {
      return true;
    }

    return (
      queryRunner.state.datasource?.uid === MIXED_DATASOURCE_NAME &&
      queryRunner.state.queries.some((query) => query.datasource?.uid === SHARED_DASHBOARD_QUERY)
    );
  }

  private handleLibPanelStateUpdates(
    newLibPanel: LibraryPanelBehaviorState,
    dashboardDsQueryRunner: SceneQueryRunner,
    sourcePanel: VizPanel
  ) {
    if (newLibPanel && newLibPanel?.isLoaded) {
      const libPanelQueryRunner = getQueryRunnerFor(sourcePanel);

      if (!(libPanelQueryRunner instanceof SceneQueryRunner)) {
        throw new Error('Could not find SceneQueryRunner for library panel');
      }
      dashboardDsQueryRunner.runQueries();
    }
  }
}
