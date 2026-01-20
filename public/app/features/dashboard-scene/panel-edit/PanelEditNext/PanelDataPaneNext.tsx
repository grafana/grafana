import { useMemo } from 'react';

import {
  CoreApp,
  DataSourceApi,
  DataSourceInstanceSettings,
  getDataSourceRef,
  getNextRefId,
  LoadingState,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { addQuery } from 'app/core/utils/query';

import { getQueryRunnerFor } from '../../utils/utils';

import { QueryEditorProvider } from './QueryEditorContext';
import { QueryEditorNext } from './QueryEditorNext';

export interface PanelDataPaneNextState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
  error?: Error;
}

/**
 * Scene wrapper for the next generation query editor.
 * Handles datasource loading and provides methods for interacting with Scene state.
 * Bridges Scene state to React Context for the UI layer.
 */
export class PanelDataPaneNext extends SceneObjectBase<PanelDataPaneNextState> {
  static Component = QueryEditorNextContainer;

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
      this.setState({ datasource: undefined, dsSettings: undefined, error: undefined });
      return;
    }

    // Get datasource ref from queryRunner or infer from first query
    // TODO: Add fallback to last-used datasource from localStorage for parity with PanelDataQueriesTab
    const dsRef = queryRunner.state.datasource ?? queryRunner.state.queries?.[0]?.datasource;
    if (!dsRef) {
      this.setState({ datasource: undefined, dsSettings: undefined, error: undefined });
      return;
    }

    try {
      const dsSettings = getDataSourceSrv().getInstanceSettings(dsRef);
      if (!dsSettings) {
        this.setState({
          datasource: undefined,
          dsSettings: undefined,
          error: new Error(`Datasource settings not found for ${dsRef.uid}`),
        });
        return;
      }

      const datasource = await getDataSourceSrv().get(dsRef);
      this.setState({ datasource, dsSettings, error: undefined });
    } catch (err) {
      console.error('Failed to load datasource:', err);
      this.setState({
        datasource: undefined,
        dsSettings: undefined,
        error: err instanceof Error ? err : new Error('Failed to load datasource'),
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

  public changeDataSource = (dsRef: DataSourceRef) => {
    const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
    if (queryRunner) {
      queryRunner.setState({ datasource: dsRef });
    }
  };
}

/**
 * Container that subscribes to Scene state and provides it via React Context.
 */
function QueryEditorNextContainer({ model }: SceneComponentProps<PanelDataPaneNext>) {
  const { panelRef, datasource, dsSettings, error } = model.useState();
  const panel = panelRef.resolve();

  // Find the SceneQueryRunner (may be wrapped by SceneDataTransformer)
  const queryRunner = getQueryRunnerFor(panel);

  // Subscribe to queryRunner state for queries and data
  const queryRunnerState = queryRunner?.useState();

  // Core context: panel, datasource (rarely changes)
  const coreValue = useMemo(
    () => ({
      panel,
      datasource,
      dsSettings,
    }),
    [panel, datasource, dsSettings]
  );

  // Queries context: query list (changes on user action)
  const queriesValue = useMemo(
    () => ({
      queries: queryRunnerState?.queries ?? [],
    }),
    [queryRunnerState?.queries]
  );

  // Data context: query results (changes frequently)
  const dataValue = useMemo(
    () => ({
      data: queryRunnerState?.data,
      isLoading: queryRunnerState?.data?.state === LoadingState.Loading,
      error,
    }),
    [queryRunnerState?.data, error]
  );

  // Actions context: stable function references
  const actionsValue = useMemo(
    () => ({
      updateQueries: model.updateQueries,
      addQuery: model.addQuery,
      deleteQuery: model.deleteQuery,
      duplicateQuery: model.duplicateQuery,
      runQueries: model.runQueries,
      changeDataSource: (settings: DataSourceInstanceSettings) => {
        model.changeDataSource(getDataSourceRef(settings));
      },
    }),
    [model]
  );

  return (
    <QueryEditorProvider core={coreValue} queries={queriesValue} data={dataValue} actions={actionsValue}>
      <QueryEditorNext />
    </QueryEditorProvider>
  );
}
