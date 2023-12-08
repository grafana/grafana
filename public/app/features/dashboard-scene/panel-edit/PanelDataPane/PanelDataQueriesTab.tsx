import React from 'react';

import { DataQuery, DataSourceApi, DataSourceInstanceSettings, IconName } from '@grafana/data';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { SceneObjectBase, SceneComponentProps, SceneObjectRef, SceneQueryRunner, sceneGraph } from '@grafana/scenes';
import { QueryEditorRows } from 'app/features/query/components/QueryEditorRows';
import { QueryGroupTopSection } from 'app/features/query/components/QueryGroup';
import { updateQueries } from 'app/features/query/state/updateQueries';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { QueryGroupOptions } from 'app/types';

import { PanelTimeRange } from '../../scene/PanelTimeRange';
import { getPanelIdForVizPanel } from '../../utils/utils';

import { PanelDataPaneTabState, PanelDataPaneTab } from './types';
interface PanelDataQueriesTabState extends PanelDataPaneTabState {
  dataRef: SceneObjectRef<SceneQueryRunner>;
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
}
export class PanelDataQueriesTab extends SceneObjectBase<PanelDataQueriesTabState> implements PanelDataPaneTab {
  static Component = PanelDataQueriesTabRendered;
  tabId = 'queries';
  icon: IconName = 'database';
  getTabLabel() {
    return 'Queries';
  }

  constructor(state: PanelDataQueriesTabState) {
    super(state);
    this.addActivationHandler(() => this._onActivate());
  }

  private _onActivate() {
    const { dataRef } = this.state;
    const dataObj = dataRef.resolve();

    this._subs.add(
      dataObj.subscribeToState((n, p) => {
        if (n.datasource !== p.datasource) {
          this.loadDataSource();
        }
      })
    );
    this.loadDataSource();
  }

  private async loadDataSource() {
    const dataObj = this.state.dataRef.resolve();

    try {
      // TODO: should return default for new panel
      const datasource = await getDataSourceSrv().get(dataObj.state.datasource);
      const dsSettings = getDataSourceSrv().getInstanceSettings(dataObj.state.datasource);
      this.setState({
        datasource,
        dsSettings,
      });
    } catch (err) {
      console.error(err);
    }
  }

  buildQueryOptions(): QueryGroupOptions {
    const { dsSettings, dataRef, panelRef } = this.state;
    const dataObj = dataRef.resolve();
    const panelObj = panelRef.resolve();
    const timeRangeObj = sceneGraph.getTimeRange(panelObj);

    let timeRangeOpts = {};

    if (timeRangeObj instanceof PanelTimeRange) {
      timeRangeOpts = {
        from: timeRangeObj.state.from,
        shift: timeRangeObj.state.timeShift,
        hide: timeRangeObj.state.hideTimeOverride,
      };
    }

    // TODO
    // store last datasource used in local storage
    // this.updateLastUsedDatasource(dataSource);

    return {
      // TODO
      // cacheTimeout: dsSettings?.meta.queryOptions?.cacheTimeout ? panel.cacheTimeout : undefined,
      dataSource: {
        default: dsSettings?.isDefault,
        type: dsSettings?.type,
        uid: dsSettings?.uid,
      },
      // TODO
      // queryCachingTTL: dsSettings?.cachingConfig?.enabled ? panel.queryCachingTTL : undefined,
      queries: dataObj.state.queries,
      maxDataPoints: dataObj.state.maxDataPoints,
      // TODO
      // minInterval: panel.interval,
      timeRange: timeRangeOpts,
    };
  }

  onOpenInspector = () => {
    const panel = this.state.panelRef.resolve();
    const panelId = getPanelIdForVizPanel(panel);

    alert('TODO: open inspector');
    locationService.partial({
      inspect: panelId,
      inspectTab: 'query',
    });
  };

  onChangeDataSource = async (
    newSettings: DataSourceInstanceSettings,
    defaultQueries?: DataQuery[] | GrafanaQuery[]
  ) => {
    const { dsSettings, dataRef } = this.state;
    const dataObj = dataRef.resolve();
    const currentDS = dsSettings ? await getDataSourceSrv().get(dsSettings.uid) : undefined;
    const nextDS = await getDataSourceSrv().get(newSettings.uid);

    // We need to pass in newSettings.uid as well here as that can be a variable expression and we want to store that in the query model not the current ds variable value
    const queries = defaultQueries || (await updateQueries(nextDS, newSettings.uid, dataObj.state.queries, currentDS));

    // Not needed, will reload on data object state change- set up in activation
    // const dataSource = await getDataSourceSrv().get(newSettings.name);

    dataObj.setState({
      datasource: {
        type: newSettings.type,
        uid: newSettings.uid,
      },
      queries,
    });

    if (defaultQueries) {
      dataObj.runQueries();
    }
  };
}

function PanelDataQueriesTabRendered({ model }: SceneComponentProps<PanelDataQueriesTab>) {
  const { dataRef, datasource, dsSettings } = model.useState();
  const dataObj = dataRef.resolve();
  const { queries, data } = dataObj.useState();

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
        onOptionsChange={() => {}}
        onOpenQueryInspector={model.onOpenInspector}
      />
      <QueryEditorRows
        data={data}
        queries={queries}
        dsSettings={dsSettings}
        onAddQuery={() => {}}
        onQueriesChange={(q) => {
          dataObj.setState({ queries: q });
        }}
        onRunQueries={() => dataObj.runQueries()}
      />
    </>
  );
}
