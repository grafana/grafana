import { css } from '@emotion/css';
import React from 'react';

import {
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldConfigSource,
  GrafanaTheme2,
  PanelModel,
  filterFieldConfigOverrides,
  isStandardFieldProp,
  restoreCustomOverrideRules,
} from '@grafana/data';
import { config, getDataSourceSrv, locationService } from '@grafana/runtime';
import {
  SceneObjectState,
  VizPanel,
  SceneObjectBase,
  SceneComponentProps,
  sceneUtils,
  DeepPartial,
  SceneQueryRunner,
  sceneGraph,
  SceneDataProvider,
  SceneDataTransformer,
} from '@grafana/scenes';
import { DataQuery, DataTransformerConfig } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { getPluginVersion } from 'app/features/dashboard/state/PanelModel';
import { getLastUsedDatasourceFromStorage } from 'app/features/dashboard/utils/dashboard';
import { storeLastUsedDataSourceInLocalStorage } from 'app/features/datasources/components/picker/utils';
import { updateQueries } from 'app/features/query/state/updateQueries';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { QueryGroupOptions } from 'app/types';

import { PanelTimeRange, PanelTimeRangeState } from '../scene/PanelTimeRange';
import { getDashboardSceneFor, getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';

interface VizPanelManagerState extends SceneObjectState {
  panel: VizPanel;
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
}

// VizPanelManager serves as an API to manipulate VizPanel state from the outside. It allows panel type, options and  data manipulation.
export class VizPanelManager extends SceneObjectBase<VizPanelManagerState> {
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

    let datasourceToLoad = this.queryRunner.state.datasource;

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

    // When changing from non-data to data panel, we need to add a new data provider
    if (!restOfOldState.$data && !config.panels[pluginType].skipDataQuery) {
      let ds = getLastUsedDatasourceFromStorage(getDashboardSceneFor(this).state.uid!)?.datasourceUid;

      if (!ds) {
        ds = config.defaultDatasource;
      }

      newPanel.setState({
        $data: new SceneDataTransformer({
          $data: new SceneQueryRunner({
            datasource: {
              uid: ds,
            },
            queries: [{ refId: 'A' }],
          }),
          transformations: [],
        }),
      });
    }

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
    this.loadDataSource();
  }

  public async changePanelDataSource(
    newSettings: DataSourceInstanceSettings,
    defaultQueries?: DataQuery[] | GrafanaQuery[]
  ) {
    const { dsSettings } = this.state;
    const queryRunner = this.queryRunner;

    const currentDS = dsSettings ? await getDataSourceSrv().get({ uid: dsSettings.uid }) : undefined;
    const nextDS = await getDataSourceSrv().get({ uid: newSettings.uid });

    const currentQueries = queryRunner.state.queries;

    // We need to pass in newSettings.uid as well here as that can be a variable expression and we want to store that in the query model not the current ds variable value
    const queries = defaultQueries || (await updateQueries(nextDS, newSettings.uid, currentQueries, currentDS));

    queryRunner.setState({
      datasource: {
        type: newSettings.type,
        uid: newSettings.uid,
      },
      queries,
    });
    if (defaultQueries) {
      queryRunner.runQueries();
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

    if (options.cacheTimeout !== dataObj?.state.cacheTimeout) {
      dataObjStateUpdate.cacheTimeout = options.cacheTimeout;
    }

    if (options.queryCachingTTL !== dataObj?.state.queryCachingTTL) {
      dataObjStateUpdate.queryCachingTTL = options.queryCachingTTL;
    }

    dataObj.setState(dataObjStateUpdate);
    dataObj.runQueries();
  }

  public changeQueries<T extends DataQuery>(queries: T[]) {
    const runner = this.queryRunner;
    runner.setState({ queries });
  }

  public changeTransformations(transformations: DataTransformerConfig[]) {
    const dataprovider = this.dataTransformer;
    dataprovider.setState({ transformations });
    dataprovider.reprocessTransformations();
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
    // Panel data object is always SceneQueryRunner wrapped in a SceneDataTransformer
    const runner = getQueryRunnerFor(this.state.panel);

    if (!runner) {
      throw new Error('Query runner not found');
    }
    return runner;
  }

  get dataTransformer(): SceneDataTransformer {
    const provider = this.state.panel.state.$data;
    if (!provider || !(provider instanceof SceneDataTransformer)) {
      throw new Error('Could not find SceneDataTransformer for panel');
    }
    return provider;
  }

  get panelData(): SceneDataProvider {
    return this.state.panel.state.$data!;
  }

  public static Component = ({ model }: SceneComponentProps<VizPanelManager>) => {
    const { panel } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.wrapper}>
        <panel.Component model={panel} />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      height: '100%',
      width: '100%',
      paddingLeft: theme.spacing(2),
    }),
  };
}
