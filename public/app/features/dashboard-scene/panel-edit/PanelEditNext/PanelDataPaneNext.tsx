import { CoreApp, DataSourceApi, DataSourceInstanceSettings, getDataSourceRef, getNextRefId } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { addQuery } from 'app/core/utils/query';
import { QueryGroupOptions } from 'app/types/query';

import { PanelTimeRange } from '../../scene/panel-timerange/PanelTimeRange';
import { getQueryRunnerFor } from '../../utils/utils';
import { getUpdatedHoverHeader } from '../getPanelFrameOptions';

import { QueryEditorContent } from './QueryEditor/QueryEditorContent';

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

    // Get datasource ref from queryRunner or infer from first query
    // TODO: Add fallback to last-used datasource from localStorage for parity with PanelDataQueriesTab
    const dsRef = queryRunner.state.datasource ?? queryRunner.state.queries?.[0]?.datasource;
    if (!dsRef) {
      this.setState({ datasource: undefined, dsSettings: undefined, dsError: undefined });
      return;
    }

    try {
      const dsSettings = getDataSourceSrv().getInstanceSettings(dsRef);
      if (!dsSettings) {
        this.setState({
          datasource: undefined,
          dsSettings: undefined,
          dsError: new Error(`Datasource settings not found for ${dsRef.uid}`),
        });
        return;
      }

      const datasource = await getDataSourceSrv().get(dsRef);
      this.setState({ datasource, dsSettings, dsError: undefined });
    } catch (err) {
      console.error('Failed to load datasource:', err);
      this.setState({
        datasource: undefined,
        dsSettings: undefined,
        dsError: err instanceof Error ? err : new Error('Failed to load datasource'),
      });
    }
  }

  // Query Operations
  public updateQueries = (queries: DataQuery[]) => {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (queryRunner) {
      queryRunner.setState({ queries });
    }
  };

  public updateSelectedQuery = (updatedQuery: DataQuery, originalRefId: string) => {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (!queryRunner) {
      return;
    }

    const queries = [...queryRunner.state.queries];
    const targetIndex = queries.findIndex((query) => query.refId === originalRefId);
    if (targetIndex < 0) {
      return;
    }

    queries[targetIndex] = updatedQuery;
    queryRunner.setState({ queries });
  };

  public addQuery = (query?: Partial<DataQuery>) => {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (!queryRunner) {
      return;
    }

    const { datasource, dsSettings } = this.state;
    const currentQueries = queryRunner.state.queries;

    // Build new query with defaults
    const newQuery: Partial<DataQuery> = {
      ...datasource?.getDefaultQuery?.(CoreApp.PanelEditor),
      ...query,
      datasource: dsSettings ? getDataSourceRef(dsSettings) : undefined,
    };

    const updatedQueries = addQuery(currentQueries, newQuery);
    queryRunner.setState({ queries: updatedQueries });
  };

  public deleteQuery = (index: number) => {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (!queryRunner) {
      return;
    }

    const queries = [...queryRunner.state.queries];
    queries.splice(index, 1);
    queryRunner.setState({ queries });
  };

  public duplicateQuery = (index: number) => {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (!queryRunner) {
      return;
    }

    const queries = [...queryRunner.state.queries];
    const queryToDuplicate = queries[index];
    if (!queryToDuplicate) {
      return;
    }

    // Insert duplicate after the original
    const duplicated = {
      ...queryToDuplicate,
      refId: getNextRefId(queries),
    };
    queries.splice(index + 1, 0, duplicated);
    queryRunner.setState({ queries });
  };

  public runQueries = () => {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (queryRunner) {
      queryRunner.runQueries();
    }
  };

  public changeDataSource = async (dsRef: DataSourceRef, queryRefId: string) => {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (!queryRunner) {
      return;
    }

    const newDataSource = getDataSourceSrv().getInstanceSettings(dsRef);
    if (!newDataSource) {
      throw new Error(`Failed to get datasource ${dsRef.uid ?? dsRef.type}`);
    }

    const targetIndex = queryRunner.state.queries.findIndex(({ refId }) => refId === queryRefId);
    if (targetIndex === -1) {
      return;
    }

    const targetQuery = queryRunner.state.queries[targetIndex];
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

    const queries = [...queryRunner.state.queries];
    queries[targetIndex] = updatedQuery;

    queryRunner.setState({ queries });
    queryRunner.runQueries();
  };

  // Query Options Operations
  public buildQueryOptions = (): QueryGroupOptions => {
    const panel = this.state.panelRef.resolve();
    const queryRunner = getQueryRunnerFor(panel);
    const { dsSettings } = this.state;

    if (!queryRunner) {
      return {
        queries: [],
        dataSource: { type: undefined, uid: undefined },
      };
    }

    const timeRangeObj = sceneGraph.getTimeRange(panel);

    let timeRangeOpts: QueryGroupOptions['timeRange'] = {
      from: undefined,
      shift: undefined,
      hide: undefined,
    };

    if (timeRangeObj instanceof PanelTimeRange) {
      timeRangeOpts = {
        from: timeRangeObj.state.timeFrom,
        shift: timeRangeObj.state.timeShift,
        hide: timeRangeObj.state.hideTimeOverride,
      };
    }

    return {
      cacheTimeout: dsSettings?.meta.queryOptions?.cacheTimeout ? queryRunner.state.cacheTimeout : undefined,
      queryCachingTTL: dsSettings?.cachingConfig?.enabled ? queryRunner.state.queryCachingTTL : undefined,
      dataSource: {
        default: dsSettings?.isDefault,
        ...(dsSettings ? getDataSourceRef(dsSettings) : { type: undefined, uid: undefined }),
      },
      queries: queryRunner.state.queries,
      maxDataPoints: queryRunner.state.maxDataPoints,
      minInterval: queryRunner.state.minInterval,
      timeRange: timeRangeOpts,
    };
  };

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
}
