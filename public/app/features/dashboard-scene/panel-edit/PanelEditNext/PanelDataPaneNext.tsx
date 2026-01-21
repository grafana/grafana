import { CoreApp, DataSourceApi, DataSourceInstanceSettings, getDataSourceRef, getNextRefId } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { addQuery } from 'app/core/utils/query';

import { getQueryRunnerFor } from '../../utils/utils';

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
 * Pure Scene object - context bridging happens at VizAndDataPaneNext level.
 */
export class PanelDataPaneNext extends SceneObjectBase<PanelDataPaneNextState> {
  static Component = QueryEditorNext;

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
