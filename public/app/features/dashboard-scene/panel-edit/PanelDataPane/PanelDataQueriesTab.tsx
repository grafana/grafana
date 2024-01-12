import React from 'react';

import { DataSourceApi, DataSourceInstanceSettings, IconName } from '@grafana/data';
import { SceneObjectBase, SceneComponentProps, SceneQueryRunner, sceneGraph } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { QueryEditorRows } from 'app/features/query/components/QueryEditorRows';
import { QueryGroupTopSection } from 'app/features/query/components/QueryGroup';
import { DashboardQueryEditor } from 'app/plugins/datasource/dashboard';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { QueryGroupOptions } from 'app/types';

import { PanelTimeRange } from '../../scene/PanelTimeRange';
import { ShareQueryDataProvider } from '../../scene/ShareQueryDataProvider';
import { VizPanelManager } from '../VizPanelManager';

import { PanelDataPaneTabState, PanelDataPaneTab } from './types';

interface PanelDataQueriesTabState extends PanelDataPaneTabState {
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
}
export class PanelDataQueriesTab extends SceneObjectBase<PanelDataQueriesTabState> implements PanelDataPaneTab {
  static Component = PanelDataQueriesTabRendered;
  tabId = 'queries';
  icon: IconName = 'database';
  private _panelManager: VizPanelManager;

  getTabLabel() {
    return 'Queries';
  }

  getItemsCount() {
    const dataObj = this._panelManager.state.panel.state.$data!;

    if (dataObj instanceof ShareQueryDataProvider) {
      return 1;
    }

    if (dataObj instanceof SceneQueryRunner) {
      return dataObj.state.queries.length;
    }

    return null;
  }

  constructor(panelManager: VizPanelManager) {
    super({});

    this._panelManager = panelManager;
  }

  buildQueryOptions(): QueryGroupOptions {
    const panelManager = this._panelManager;
    const panelObj = this._panelManager.state.panel;
    const dataObj = panelObj.state.$data!;
    const queryRunner = this._panelManager.queryRunner;

    const timeRangeObj = sceneGraph.getTimeRange(panelObj);

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

    let queries: QueryGroupOptions['queries'] = [];
    if (dataObj instanceof ShareQueryDataProvider) {
      queries = [dataObj.state.query];
    }

    if (dataObj instanceof SceneQueryRunner) {
      queries = dataObj.state.queries;
    }

    return {
      // TODO
      // cacheTimeout: dsSettings?.meta.queryOptions?.cacheTimeout ? panel.cacheTimeout : undefined,
      // queryCachingTTL: dsSettings?.cachingConfig?.enabled ? panel.queryCachingTTL : undefined,
      dataSource: {
        default: panelManager.state.dsSettings?.isDefault,
        type: panelManager.state.dsSettings?.type,
        uid: panelManager.state.dsSettings?.uid,
      },
      queries,
      maxDataPoints: queryRunner.state.maxDataPoints,
      minInterval: queryRunner.state.minInterval,
      timeRange: timeRangeOpts,
    };
  }

  onOpenInspector = () => {
    this._panelManager.inspectPanel();
  };

  onChangeDataSource = async (
    newSettings: DataSourceInstanceSettings,
    defaultQueries?: DataQuery[] | GrafanaQuery[]
  ) => {
    this._panelManager.changePanelDataSource(newSettings, defaultQueries);
  };

  onQueryOptionsChange = (options: QueryGroupOptions) => {
    this._panelManager.changeQueryOptions(options);
  };

  onQueriesChange = (queries: DataQuery[]) => {
    this._panelManager.changeQueries(queries);
  };

  onRunQueries = () => {
    this._panelManager.queryRunner.runQueries();
  };

  getQueries() {
    const dataObj = this._panelManager.state.panel.state.$data!;

    if (dataObj instanceof ShareQueryDataProvider) {
      return [dataObj.state.query];
    }
    return this._panelManager.queryRunner.state.queries;
  }

  get panelManager() {
    return this._panelManager;
  }
}

function PanelDataQueriesTabRendered({ model }: SceneComponentProps<PanelDataQueriesTab>) {
  const { panel, datasource, dsSettings } = model.panelManager.useState();
  const { $data: dataObj } = panel.useState();
  const { data } = dataObj!.useState();

  if (!datasource || !dsSettings || !data) {
    return null;
  }

  return (
    <>
      <QueryGroupTopSection
        data={data}
        dsSettings={dsSettings}
        dataSource={datasource}
        options={model.buildQueryOptions()}
        onDataSourceChange={model.onChangeDataSource}
        onOptionsChange={model.onQueryOptionsChange}
        onOpenQueryInspector={model.onOpenInspector}
      />

      {dataObj instanceof ShareQueryDataProvider ? (
        <DashboardQueryEditor queries={model.getQueries()} panelData={data} onChange={model.onQueriesChange} />
      ) : (
        <QueryEditorRows
          data={data}
          queries={model.getQueries()}
          dsSettings={dsSettings}
          onAddQuery={() => {}}
          onQueriesChange={model.onQueriesChange}
          onRunQueries={model.onRunQueries}
        />
      )}
    </>
  );
}
