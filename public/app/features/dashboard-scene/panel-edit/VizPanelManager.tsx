import React from 'react';

import {
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldConfigSource,
  LoadingState,
  PanelModel,
  filterFieldConfigOverrides,
  getDefaultTimeRange,
  isStandardFieldProp,
  restoreCustomOverrideRules,
} from '@grafana/data';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import {
  SceneObjectState,
  VizPanel,
  SceneObjectBase,
  SceneComponentProps,
  sceneUtils,
  DeepPartial,
  SceneQueryRunner,
  sceneGraph,
  SceneDataTransformer,
  SceneDataProvider,
} from '@grafana/scenes';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { getPluginVersion } from 'app/features/dashboard/state/PanelModel';
import { storeLastUsedDataSourceInLocalStorage } from 'app/features/datasources/components/picker/utils';
import { updateQueries } from 'app/features/query/state/updateQueries';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { DASHBOARD_DATASOURCE_PLUGIN_ID, DashboardQuery } from 'app/plugins/datasource/dashboard/types';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { QueryGroupOptions } from 'app/types';

import { PanelTimeRange, PanelTimeRangeState } from '../scene/PanelTimeRange';
import { ShareQueryDataProvider } from '../scene/ShareQueryDataProvider';
import { getPanelIdForVizPanel } from '../utils/utils';

interface VizPanelManagerState extends SceneObjectState {
  panel: VizPanel;
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
}

// VizPanelManager serves as an API to manipulate VizPanel state from the outside. It allows panel type, options and  data maniulation.
export class VizPanelManager extends SceneObjectBase<VizPanelManagerState> {
  public static Component = ({ model }: SceneComponentProps<VizPanelManager>) => {
    const { panel } = model.useState();

    return <panel.Component model={panel} />;
  };

  private _cachedPluginOptions: Record<
    string,
    { options: DeepPartial<{}>; fieldConfig: FieldConfigSource<DeepPartial<{}>> } | undefined
  > = {};

  public constructor(panel: VizPanel) {
    super({ panel });

    this.addActivationHandler(() => this._onActivate());
  }

  private _onActivate() {
    this.loadDataSource();
  }

  private async loadDataSource() {
    const dataObj = this.state.panel.state.$data;

    if (!dataObj) {
      return;
    }

    let datasourceToLoad: DataSourceRef | undefined;

    if (dataObj instanceof ShareQueryDataProvider) {
      datasourceToLoad = {
        uid: SHARED_DASHBOARD_QUERY,
        type: DASHBOARD_DATASOURCE_PLUGIN_ID,
      };
    } else {
      datasourceToLoad = this.queryRunner.state.datasource;
    }

    if (!datasourceToLoad) {
      return;
    }

    try {
      // TODO: Handle default/last used datasource selection for new panel
      // Ref: PanelEditorQueries / componentDidMount
      const datasource = await getDataSourceSrv().get(datasourceToLoad);
      const dsSettings = getDataSourceSrv().getInstanceSettings(datasourceToLoad);

      if (datasource && dsSettings) {
        this.setState({
          datasource,
          dsSettings,
        });

        storeLastUsedDataSourceInLocalStorage(
          {
            type: dsSettings.type,
            uid: dsSettings.uid,
          } || { default: true }
        );
      }
    } catch (err) {
      console.error(err);
    }
  }

  public changePluginType(pluginType: string) {
    const {
      options: prevOptions,
      fieldConfig: prevFieldConfig,
      pluginId: prevPluginId,
      ...restOfOldState
    } = sceneUtils.cloneSceneObjectState(this.state.panel.state);

    // clear custom options
    let newFieldConfig = { ...prevFieldConfig };
    newFieldConfig.defaults = {
      ...newFieldConfig.defaults,
      custom: {},
    };
    newFieldConfig.overrides = filterFieldConfigOverrides(newFieldConfig.overrides, isStandardFieldProp);

    this._cachedPluginOptions[prevPluginId] = { options: prevOptions, fieldConfig: prevFieldConfig };
    const cachedOptions = this._cachedPluginOptions[pluginType]?.options;
    const cachedFieldConfig = this._cachedPluginOptions[pluginType]?.fieldConfig;
    if (cachedFieldConfig) {
      newFieldConfig = restoreCustomOverrideRules(newFieldConfig, cachedFieldConfig);
    }

    const newPanel = new VizPanel({
      options: cachedOptions ?? {},
      fieldConfig: newFieldConfig,
      pluginId: pluginType,
      ...restOfOldState,
    });

    const newPlugin = newPanel.getPlugin();
    const panel: PanelModel = {
      title: newPanel.state.title,
      options: newPanel.state.options,
      fieldConfig: newPanel.state.fieldConfig,
      id: 1,
      type: pluginType,
    };
    const newOptions = newPlugin?.onPanelTypeChanged?.(panel, prevPluginId, prevOptions, prevFieldConfig);
    if (newOptions) {
      newPanel.onOptionsChange(newOptions, true);
    }

    if (newPlugin?.onPanelMigration) {
      newPanel.setState({ pluginVersion: getPluginVersion(newPlugin) });
    }

    this.setState({ panel: newPanel });
  }

  public async changePanelDataSource(
    newSettings: DataSourceInstanceSettings,
    defaultQueries?: DataQuery[] | GrafanaQuery[]
  ) {
    const { panel, dsSettings } = this.state;
    const dataObj = panel.state.$data;
    if (!dataObj) {
      return;
    }

    const currentDS = dsSettings ? await getDataSourceSrv().get({ uid: dsSettings.uid }) : undefined;
    const nextDS = await getDataSourceSrv().get({ uid: newSettings.uid });

    const currentQueries = [];
    if (dataObj instanceof SceneQueryRunner) {
      currentQueries.push(...dataObj.state.queries);
    } else if (dataObj instanceof ShareQueryDataProvider) {
      currentQueries.push(dataObj.state.query);
    }

    // We need to pass in newSettings.uid as well here as that can be a variable expression and we want to store that in the query model not the current ds variable value
    const queries = defaultQueries || (await updateQueries(nextDS, newSettings.uid, currentQueries, currentDS));

    if (dataObj instanceof SceneQueryRunner) {
      // Changing to Dashboard data source
      if (newSettings.uid === SHARED_DASHBOARD_QUERY) {
        // Changing from one plugin to another
        const sharedProvider = new ShareQueryDataProvider({
          query: queries[0],
          $data: new SceneQueryRunner({
            queries: [],
          }),
          data: {
            series: [],
            state: LoadingState.NotStarted,
            timeRange: getDefaultTimeRange(),
          },
        });
        panel.setState({ $data: sharedProvider });
      } else {
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
      }
    } else if (dataObj instanceof ShareQueryDataProvider && newSettings.uid !== SHARED_DASHBOARD_QUERY) {
      const dataProvider = new SceneQueryRunner({
        datasource: {
          type: newSettings.type,
          uid: newSettings.uid,
        },
        queries,
      });
      panel.setState({ $data: dataProvider });
    } else if (dataObj instanceof SceneDataTransformer) {
      const data = dataObj.clone();

      let provider: SceneDataProvider = new SceneQueryRunner({
        datasource: {
          type: newSettings.type,
          uid: newSettings.uid,
        },
        queries,
      });

      if (newSettings.uid === SHARED_DASHBOARD_QUERY) {
        provider = new ShareQueryDataProvider({
          query: queries[0],
          $data: new SceneQueryRunner({
            queries: [],
          }),
          data: {
            series: [],
            state: LoadingState.NotStarted,
            timeRange: getDefaultTimeRange(),
          },
        });
      }

      data.setState({
        $data: provider,
      });

      panel.setState({ $data: data });
    }
    this.loadDataSource();
  }

  public changeQueryOptions(options: QueryGroupOptions) {
    const panelObj = this.state.panel;
    const dataObj = this.queryRunner;
    let timeRangeObj = sceneGraph.getTimeRange(panelObj);

    const dataObjStateUpdate: Partial<SceneQueryRunner['state']> = {};
    const timeRangeObjStateUpdate: Partial<PanelTimeRangeState> = {};

    if (options.maxDataPoints !== dataObj.state.maxDataPoints) {
      dataObjStateUpdate.maxDataPoints = options.maxDataPoints ?? undefined;
    }
    if (options.minInterval !== dataObj.state.minInterval && options.minInterval !== null) {
      dataObjStateUpdate.minInterval = options.minInterval;
    }
    if (options.timeRange) {
      timeRangeObjStateUpdate.timeFrom = options.timeRange.from ?? undefined;
      timeRangeObjStateUpdate.timeShift = options.timeRange.shift ?? undefined;
      timeRangeObjStateUpdate.hideTimeOverride = options.timeRange.hide;
    }
    if (timeRangeObj instanceof PanelTimeRange) {
      if (timeRangeObjStateUpdate.timeFrom !== undefined || timeRangeObjStateUpdate.timeShift !== undefined) {
        // update time override
        timeRangeObj.setState(timeRangeObjStateUpdate);
      } else {
        // remove time override
        panelObj.setState({ $timeRange: undefined });
      }
    } else {
      // no time override present on the panel, let's create one first
      panelObj.setState({ $timeRange: new PanelTimeRange(timeRangeObjStateUpdate) });
    }

    dataObj.setState(dataObjStateUpdate);
    dataObj.runQueries();
  }

  public changeQueries<T extends DataQuery>(queries: T[]) {
    const dataObj = this.state.panel.state.$data;
    const runner = this.queryRunner;

    if (dataObj instanceof ShareQueryDataProvider && queries.length > 0) {
      const dashboardQuery = queries[0] as DashboardQuery;
      if (dashboardQuery.panelId) {
        dataObj.setState({
          query: dashboardQuery,
        });
      }
    } else {
      runner.setState({ queries });
    }
  }

  public inspectPanel() {
    const panel = this.state.panel;
    const panelId = getPanelIdForVizPanel(panel);

    locationService.partial({
      inspect: panelId,
      inspectTab: 'query',
    });
  }

  get queryRunner(): SceneQueryRunner {
    const dataObj = this.state.panel.state.$data;

    if (dataObj instanceof ShareQueryDataProvider) {
      return dataObj.state.$data as SceneQueryRunner;
    }

    if (dataObj instanceof SceneDataTransformer) {
      return dataObj.state.$data as SceneQueryRunner;
    }

    return dataObj as SceneQueryRunner;
  }

  get panelData(): SceneDataProvider {
    return this.state.panel.state.$data!;
  }
}
