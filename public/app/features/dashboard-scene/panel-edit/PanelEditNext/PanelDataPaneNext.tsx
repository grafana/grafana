import {
  CoreApp,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataTransformerConfig,
  getDataSourceRef,
  getNextRefId,
} from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import {
  SceneDataTransformer,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { addQuery } from 'app/core/utils/query';
import { getLastUsedDatasourceFromStorage } from 'app/features/dashboard/utils/dashboard';
import { storeLastUsedDataSourceInLocalStorage } from 'app/features/datasources/components/picker/utils';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { QueryGroupOptions } from 'app/types/query';

import { PanelTimeRange } from '../../scene/panel-timerange/PanelTimeRange';
import { getDashboardSceneFor, getQueryRunnerFor } from '../../utils/utils';
import { getUpdatedHoverHeader } from '../getPanelFrameOptions';

import { QueryEditorContent } from './QueryEditor/QueryEditorContent';
import { filterDataTransformerConfigs } from './QueryEditor/utils';

/**
 * Resolve the datasource ref to assign to a new query.
 */
function resolveNewQueryDatasource(
  callerDs: DataSourceRef | undefined,
  panelDsSettings: DataSourceInstanceSettings | undefined
): DataSourceRef | undefined {
  // Caller explicitly chose a datasource (e.g. ExpressionDatasourceRef).
  if (callerDs) {
    return callerDs;
  }

  if (!panelDsSettings) {
    return undefined;
  }

  // "Mixed" isn't meaningful on a per-query basis; use the configured default.
  // If missing a default datasource (unexpected), leave `undefined`
  // so the query inherits the panel datasource at render time.
  if (panelDsSettings.meta.mixed) {
    const defaultDs = getDataSourceSrv().getInstanceSettings(config.defaultDatasource);
    return defaultDs ? getDataSourceRef(defaultDs) : undefined;
  }

  return getDataSourceRef(panelDsSettings);
}

export interface PanelDataPaneNextState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
  dsError?: Error;
}

/**
 * Scene wrapper for the next generation query editor.
 * Handles datasource loading and provides methods for interacting with Scene state.
 * Pure Scene object - context bridging happens at VizAndDataPaneNext level.
 */
export class PanelDataPaneNext extends SceneObjectBase<PanelDataPaneNextState> {
  static Component = QueryEditorContent;

  public constructor(state: PanelDataPaneNextState) {
    super(state);
    this.addActivationHandler(() => this.onActivate());
  }

  private onActivate() {
    this.loadDatasource();

    // Subscribe to datasource changes on the queryRunner
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (queryRunner) {
      this._subs.add(
        queryRunner.subscribeToState((newState, oldState) => {
          if (newState.datasource !== oldState.datasource) {
            this.loadDatasource();
          }
        })
      );
    }
  }

  private async loadDatasource() {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (!queryRunner) {
      this.setState({ datasource: undefined, dsSettings: undefined, dsError: undefined });
      return;
    }

    try {
      let datasource: DataSourceApi | undefined;
      let dsSettings: DataSourceInstanceSettings | undefined;

      // Get datasource ref from queryRunner or infer from first query
      let datasourceToLoad = queryRunner.state.datasource ?? queryRunner.state.queries?.[0]?.datasource;

      // Fallback to last-used datasource from localStorage (parity with PanelDataQueriesTab)
      if (!datasourceToLoad) {
        const dashboard = getDashboardSceneFor(this);
        const dashboardUid = dashboard.state.uid ?? '';
        const lastUsedDatasource = getLastUsedDatasourceFromStorage(dashboardUid);

        if (lastUsedDatasource?.datasourceUid) {
          dsSettings = getDataSourceSrv().getInstanceSettings({ uid: lastUsedDatasource.datasourceUid });
          if (dsSettings) {
            datasource = await getDataSourceSrv().get({
              uid: lastUsedDatasource.datasourceUid,
              type: dsSettings.type,
            });

            queryRunner.setState({
              datasource: {
                ...getDataSourceRef(dsSettings),
                uid: lastUsedDatasource.datasourceUid,
              },
            });
          }
        }
      } else {
        datasource = await getDataSourceSrv().get(datasourceToLoad);
        dsSettings = getDataSourceSrv().getInstanceSettings(datasourceToLoad);
      }

      if (datasource && dsSettings) {
        this.setState({ datasource, dsSettings, dsError: undefined });
        storeLastUsedDataSourceInLocalStorage(getDataSourceRef(dsSettings) || { default: true });
      } else {
        this.setState({ datasource: undefined, dsSettings: undefined, dsError: undefined });
      }
    } catch (err) {
      console.error('Failed to load datasource:', err);

      // Fallback to default datasource (parity with PanelDataQueriesTab)
      try {
        const datasource = await getDataSourceSrv().get(config.defaultDatasource);
        const dsSettings = getDataSourceSrv().getInstanceSettings(config.defaultDatasource);

        if (datasource && dsSettings) {
          this.setState({ datasource, dsSettings, dsError: undefined });
          queryRunner.setState({
            datasource: getDataSourceRef(dsSettings),
          });
        }
      } catch (fallbackErr) {
        console.error('Failed to load default datasource:', fallbackErr);
        this.setState({
          datasource: undefined,
          dsSettings: undefined,
          dsError: err instanceof Error ? err : new Error('Failed to load datasource'),
        });
      }
    }
  }

  /**
   * Helper for operations that find and mutate a single query by refId.
   * Handles cloning, finding index, and updating state.
   */
  private mutateQuery(refId: string, mutator: (query: DataQuery, index: number, queries: DataQuery[]) => DataQuery[]) {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (!queryRunner) {
      return;
    }

    const queries = [...queryRunner.state.queries];
    const index = queries.findIndex((q) => q.refId === refId);
    if (index === -1) {
      return;
    }

    const updatedQueries = mutator(queries[index], index, queries);
    queryRunner.setState({ queries: updatedQueries });
  }

  // Query Operations
  public updateQueries = (queries: DataQuery[]) => {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (queryRunner) {
      queryRunner.setState({ queries });
    }
  };

  public updateSelectedQuery = (updatedQuery: DataQuery, originalRefId: string) => {
    this.mutateQuery(originalRefId, (_query, index, queries) => {
      queries[index] = updatedQuery;
      return queries;
    });
  };

  public addQuery = (query?: Partial<DataQuery>, afterRefId?: string): string | undefined => {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (!queryRunner) {
      return;
    }

    const { datasource, dsSettings } = this.state;
    const currentQueries = queryRunner.state.queries;

    // Build new query with defaults.
    const newQuery: Partial<DataQuery> = {
      ...datasource?.getDefaultQuery?.(CoreApp.PanelEditor),
      ...query,
    };

    newQuery.datasource = resolveNewQueryDatasource(newQuery.datasource ?? undefined, dsSettings);

    const updatedQueries = addQuery(currentQueries, newQuery);

    // Identify the newly added query by refId rather than position, so this
    // is resilient to future changes in how addQuery orders the array.
    const existingRefIds = new Set(currentQueries.map((q) => q.refId));
    const newItem = updatedQueries.find((q) => !existingRefIds.has(q.refId));

    // If afterRefId is specified, move the new query to just after it
    if (afterRefId && newItem) {
      const newItemIndex = updatedQueries.indexOf(newItem);
      if (newItemIndex !== -1) {
        updatedQueries.splice(newItemIndex, 1);
      }
      const afterIndex = updatedQueries.findIndex((q) => q.refId === afterRefId);
      if (afterIndex !== -1) {
        updatedQueries.splice(afterIndex + 1, 0, newItem);
      } else {
        updatedQueries.push(newItem); // fallback to append if not found
      }
    }

    queryRunner.setState({ queries: updatedQueries });

    return newItem?.refId;
  };

  public deleteQuery = (refId: string) => {
    this.mutateQuery(refId, (_query, index, queries) => {
      queries.splice(index, 1);
      return queries;
    });
    this.runQueries();
  };

  public duplicateQuery = (refId: string) => {
    this.mutateQuery(refId, (query, index, queries) => {
      const duplicated = {
        ...query,
        refId: getNextRefId(queries),
      };
      queries.splice(index + 1, 0, duplicated);
      return queries;
    });
    this.runQueries();
  };

  public toggleQueryHide = (refId: string) => {
    this.mutateQuery(refId, (query, index, queries) => {
      queries[index] = { ...query, hide: !query.hide };
      return queries;
    });
    this.runQueries();
  };

  public runQueries = () => {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (queryRunner) {
      queryRunner.runQueries();
    }
  };

  // Transformation Operations
  private getSceneDataTransformer(): SceneDataTransformer | undefined {
    const panel = this.state.panelRef.resolve();
    if (panel.state.$data instanceof SceneDataTransformer) {
      return panel.state.$data;
    }
    return undefined;
  }

  private getTransformations(index: number): {
    transformations: DataTransformerConfig[] | undefined;
    transformer: SceneDataTransformer | undefined;
  } {
    const transformer = this.getSceneDataTransformer();

    if (transformer) {
      const transformations = filterDataTransformerConfigs([...transformer.state.transformations]);

      if (index >= 0 && index < transformations.length) {
        return { transformations, transformer };
      }
    }

    return { transformations: undefined, transformer: undefined };
  }

  public addTransformation = (transformationId: string, afterIndex?: number): number | undefined => {
    const transformer = this.getSceneDataTransformer();
    if (!transformer) {
      return;
    }

    const transformations = filterDataTransformerConfigs([...transformer.state.transformations]);
    const newConfig: DataTransformerConfig = { id: transformationId, options: {} };
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : transformations.length;
    transformations.splice(insertAt, 0, newConfig);
    transformer.setState({ transformations });
    transformer.reprocessTransformations();
    return insertAt;
  };

  public reorderTransformations = (transformations: DataTransformerConfig[]) => {
    const transformer = this.getSceneDataTransformer();
    if (transformer) {
      transformer.setState({ transformations });
      transformer.reprocessTransformations();
    }
  };

  public deleteTransformation = (index: number) => {
    const { transformations, transformer } = this.getTransformations(index);
    if (!transformations || !transformer) {
      return;
    }

    transformations.splice(index, 1);
    transformer.setState({ transformations });
    this.runQueries();
  };

  public toggleTransformationDisabled = (index: number) => {
    const { transformations, transformer } = this.getTransformations(index);
    if (!transformations || !transformer) {
      return;
    }

    const transformation = transformations[index];
    transformations[index] = { ...transformation, disabled: !transformation.disabled };
    transformer.setState({ transformations });
    this.runQueries();
  };

  /**
   * Changes the datasource for a specific query.
   *
   * Panel-level vs Per-query datasources:
   * - Normally, a panel has a single datasource and all queries inherit from it
   * - When queries use different datasources, the panel switches to "Mixed" mode
   * - In Mixed mode, each query must have an explicit datasource property
   *
   * This method:
   * 1. Updates the target query with the new datasource (applying default query if type changed)
   * 2. If not already Mixed, transitions the panel to Mixed mode by:
   *    - Enriching all queries without explicit datasources with the current panel datasource
   *    - Setting the panel datasource to "Mixed"
   * 3. Runs the queries with the new configuration
   *
   * @param dsRef - The datasource reference to switch to
   * @param queryRefId - The refId of the query to update
   */
  public changeDataSource = async (dsRef: DataSourceRef, queryRefId: string) => {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (!queryRunner) {
      return;
    }

    const newDataSource = getDataSourceSrv().getInstanceSettings(dsRef);
    if (!newDataSource) {
      throw new Error(`Failed to get datasource ${dsRef.uid ?? dsRef.type}`);
    }

    const queries = [...queryRunner.state.queries];
    const targetIndex = queries.findIndex(({ refId }) => refId === queryRefId);
    if (targetIndex === -1) {
      return;
    }

    const targetQuery = queries[targetIndex];
    const previousDataSource = targetQuery.datasource
      ? getDataSourceSrv().getInstanceSettings(targetQuery.datasource)
      : undefined;

    const shouldUseDefaultQuery = !previousDataSource || previousDataSource.type !== newDataSource.type;

    let updatedQuery: DataQuery;
    if (shouldUseDefaultQuery) {
      try {
        const ds = await getDataSourceSrv().get(dsRef);
        updatedQuery = { ...ds.getDefaultQuery?.(CoreApp.PanelEditor), ...targetQuery, datasource: dsRef };
      } catch {
        throw new Error(`Failed to get datasource ${newDataSource.name ?? newDataSource.uid}`);
      }
    } else {
      updatedQuery = { ...targetQuery, datasource: dsRef };
    }

    queries[targetIndex] = updatedQuery;

    // Transition to Mixed mode if not already there.
    // Mixed mode is required when queries use different datasources, ensuring each query's
    // datasource is respected during execution.
    if (queryRunner.state.datasource?.uid !== MIXED_DATASOURCE_NAME) {
      // CRITICAL: Before switching to Mixed, enrich all queries without explicit datasources.
      // Mixed datasource has no QueryEditor component and can't be edited directly.
      // Queries that inherit from Mixed would fail with "Data source plugin does not export any query editor component".
      // We must "freeze" their current inherited datasource into an explicit datasource property.
      // Matches legacy behavior in PanelDataQueriesTab.tsx:onSelectQueryFromLibrary (lines 391-410)
      const currentPanelDsRef = queryRunner.state.datasource;
      const fallbackDsRef =
        currentPanelDsRef || getDataSourceRef(getDataSourceSrv().getInstanceSettings(config.defaultDatasource)!);

      const queriesWithExplicitDs = queries.map((query) => {
        if (query.datasource) {
          return query; // Already has explicit datasource
        }
        return { ...query, datasource: fallbackDsRef }; // Set inherited datasource explicitly
      });

      queryRunner.setState({
        queries: queriesWithExplicitDs,
        datasource: { type: 'mixed', uid: MIXED_DATASOURCE_NAME },
      });
    } else {
      queryRunner.setState({ queries });
    }

    queryRunner.runQueries();
  };

  // Query Options Operations
  public onQueryOptionsChange = (options: QueryGroupOptions) => {
    const panel = this.state.panelRef.resolve();
    const queryRunner = getQueryRunnerFor(panel);

    if (!queryRunner) {
      return;
    }

    const dataObjStateUpdate: Partial<SceneQueryRunner['state']> = {};
    const panelStateUpdate: Partial<VizPanel['state']> = {};

    if (options.maxDataPoints !== queryRunner.state.maxDataPoints) {
      dataObjStateUpdate.maxDataPoints = options.maxDataPoints ?? undefined;
    }

    if (options.minInterval !== queryRunner.state.minInterval) {
      dataObjStateUpdate.minInterval = options.minInterval ?? undefined;
    }

    const timeFrom = options.timeRange?.from ?? undefined;
    const timeShift = options.timeRange?.shift ?? undefined;
    const hideTimeOverride = options.timeRange?.hide;

    if (timeFrom || timeShift) {
      panelStateUpdate.$timeRange = new PanelTimeRange({ timeFrom, timeShift, hideTimeOverride });
      panelStateUpdate.hoverHeader = getUpdatedHoverHeader(panel.state.title, panelStateUpdate.$timeRange);
    } else {
      panelStateUpdate.$timeRange = undefined;
      panelStateUpdate.hoverHeader = getUpdatedHoverHeader(panel.state.title, undefined);
    }

    if (options.cacheTimeout !== queryRunner.state.cacheTimeout) {
      dataObjStateUpdate.cacheTimeout = options.cacheTimeout;
    }

    if (options.queryCachingTTL !== queryRunner.state.queryCachingTTL) {
      dataObjStateUpdate.queryCachingTTL = options.queryCachingTTL;
    }

    panel.setState(panelStateUpdate);
    queryRunner.setState(dataObjStateUpdate);
    queryRunner.runQueries();
  };

  public updateTransformation = (oldConfig: DataTransformerConfig, newConfig: DataTransformerConfig) => {
    const panel = this.state.panelRef.resolve();
    const queryRunner = getQueryRunnerFor(panel);
    const dataTransformer = panel.state.$data;

    if (!(dataTransformer instanceof SceneDataTransformer)) {
      return;
    }

    const transformations = [...dataTransformer.state.transformations];
    // Find by object reference - same reference from useTransformations hook
    const index = transformations.findIndex((t) => t === oldConfig);

    if (index === -1) {
      return;
    }

    transformations[index] = newConfig;
    dataTransformer.setState({ transformations });

    if (!queryRunner) {
      return;
    }

    queryRunner.runQueries();
  };
}
