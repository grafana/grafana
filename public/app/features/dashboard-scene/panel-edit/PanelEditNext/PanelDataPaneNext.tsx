import {
  CoreApp,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataTransformerConfig,
  getDataSourceRef,
  getNextRefId,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
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
import { QueryGroupOptions } from 'app/types/query';

import { PanelTimeRange } from '../../scene/panel-timerange/PanelTimeRange';
import { getQueryRunnerFor } from '../../utils/utils';
import { getUpdatedHoverHeader } from '../getPanelFrameOptions';

import { QueryEditorContent } from './QueryEditor/QueryEditorContent';
import { filterDataTransformerConfigs } from './QueryEditor/utils';

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
    // Preserve the caller-supplied datasource (e.g. ExpressionDatasourceRef)
    // and only fall back to the panel datasource when none was provided.
    const newQuery: Partial<DataQuery> = {
      ...datasource?.getDefaultQuery?.(CoreApp.PanelEditor),
      ...query,
    };

    if (!newQuery.datasource && dsSettings) {
      newQuery.datasource = getDataSourceRef(dsSettings);
    }

    const updatedQueries = addQuery(currentQueries, newQuery);
    const newItem = updatedQueries[updatedQueries.length - 1];

    // If afterRefId is specified, move the new query (currently at end) to just after it
    if (afterRefId) {
      updatedQueries.pop();
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

    queryRunner.setState({ queries });
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
