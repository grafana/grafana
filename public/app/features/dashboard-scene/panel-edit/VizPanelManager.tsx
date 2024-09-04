import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useEffect } from 'react';

import {
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldConfigSource,
  GrafanaTheme2,
  filterFieldConfigOverrides,
  getDataSourceRef,
  isStandardFieldProp,
  restoreCustomOverrideRules,
} from '@grafana/data';
import { config, getDataSourceSrv, locationService } from '@grafana/runtime';
import {
  DeepPartial,
  PanelBuilders,
  SceneComponentProps,
  SceneDataTransformer,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectStateChangedEvent,
  SceneQueryRunner,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';
import { DataQuery, DataTransformerConfig, Panel } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { getLastUsedDatasourceFromStorage } from 'app/features/dashboard/utils/dashboard';
import { storeLastUsedDataSourceInLocalStorage } from 'app/features/datasources/components/picker/utils';
import { saveLibPanel } from 'app/features/library-panels/state/api';
import { updateQueries } from 'app/features/query/state/updateQueries';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { QueryGroupOptions } from 'app/types';

import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { getPanelChanges } from '../saving/getDashboardChanges';
import { RepeatDirection } from '../scene/DashboardGridItem';
import { PanelTimeRange, PanelTimeRangeState } from '../scene/PanelTimeRange';
import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import {
  getDashboardSceneFor,
  getLibraryPanelBehavior,
  getPanelIdForVizPanel,
  getQueryRunnerFor,
  isLibraryPanel,
} from '../utils/utils';

export interface VizPanelManagerState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  pluginId: string;
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
  tableView?: VizPanel;
  repeat?: string;
  repeatDirection?: RepeatDirection;
  maxPerRow?: number;
  isDirty?: boolean;
}

export enum DisplayMode {
  Fill = 0,
  Fit = 1,
  Exact = 2,
}

// VizPanelManager serves as an API to manipulate VizPanel state from the outside. It allows panel type, options and  data manipulation.
export class VizPanelManager extends SceneObjectBase<VizPanelManagerState> {
  private _cachedPluginOptions: Record<
    string,
    { options: DeepPartial<{}>; fieldConfig: FieldConfigSource<DeepPartial<{}>> } | undefined
  > = {};

  private _originalState: Partial<VizPanelState> = {};
  private _originalSaveModel: Panel;

  public constructor(state: VizPanelManagerState) {
    super(state);

    this._originalState = state.panelRef.resolve().state;
    this._originalSaveModel = vizPanelToPanel(state.panelRef.resolve());

    this.addActivationHandler(() => this._onActivate());
  }

  /**
   * Will clone the source panel and move the data provider to
   * live on the VizPanelManager level instead of the VizPanel level
   */
  public static createFor(panel: VizPanel) {
    return new VizPanelManager({
      panelRef: panel.getRef(),
      pluginId: panel.state.pluginId,
    });
  }

  private _onActivate() {
    this.loadDataSource();
    const changesSub = this.getPanel().subscribeToEvent(SceneObjectStateChangedEvent, this._handleStateChange);

    return () => {
      changesSub.unsubscribe();
    };
  }

  public getPanel() {
    return this.state.panelRef.resolve();
  }

  private _detectPanelModelChanges = debounce(() => {
    const { hasChanges } = getPanelChanges(this._originalSaveModel, vizPanelToPanel(this.panel));
    this.setState({ isDirty: hasChanges });
  }, 250);

  private _handleStateChange = (event: SceneObjectStateChangedEvent) => {
    if (DashboardSceneChangeTracker.isUpdatingPersistedState(event)) {
      this._detectPanelModelChanges();
    }
  };

  public discardChanges() {
    this.setState({ isDirty: false });

    const panel = this.getPanel();
    const pluginIdChanged = panel.state.pluginId !== this._originalState.pluginId;

    panel.setState(this._originalState);

    // Hande plugin change revert
    if (pluginIdChanged) {
      panel.changePluginType(
        this._originalState.pluginId!,
        this._originalState.options,
        this._originalState.fieldConfig
      );
    }
  }

  private async loadDataSource() {
    const panel = this.getPanel();
    const dataObj = panel.state.$data;

    if (!dataObj) {
      return;
    }

    let datasourceToLoad = this.queryRunner.state.datasource;

    try {
      let datasource: DataSourceApi | undefined;
      let dsSettings: DataSourceInstanceSettings | undefined;

      if (!datasourceToLoad) {
        const dashboardScene = getDashboardSceneFor(this);
        const dashboardUid = dashboardScene.state.uid ?? '';
        const lastUsedDatasource = getLastUsedDatasourceFromStorage(dashboardUid!);

        // do we have a last used datasource for this dashboard
        if (lastUsedDatasource?.datasourceUid !== null) {
          // get datasource from dashbopard uid
          dsSettings = getDataSourceSrv().getInstanceSettings({ uid: lastUsedDatasource?.datasourceUid });
          if (dsSettings) {
            datasource = await getDataSourceSrv().get({
              uid: lastUsedDatasource?.datasourceUid,
              type: dsSettings.type,
            });

            this.queryRunner.setState({
              datasource: {
                ...getDataSourceRef(dsSettings),
                uid: lastUsedDatasource?.datasourceUid,
              },
            });
          }
        }
      } else {
        datasource = await getDataSourceSrv().get(datasourceToLoad);
        dsSettings = getDataSourceSrv().getInstanceSettings(datasourceToLoad);
      }

      if (datasource && dsSettings) {
        this.setState({ datasource, dsSettings });

        storeLastUsedDataSourceInLocalStorage(getDataSourceRef(dsSettings) || { default: true });
      }
    } catch (err) {
      //set default datasource if we fail to load the datasource
      const datasource = await getDataSourceSrv().get(config.defaultDatasource);
      const dsSettings = getDataSourceSrv().getInstanceSettings(config.defaultDatasource);

      if (datasource && dsSettings) {
        this.setState({
          datasource,
          dsSettings,
        });

        this.queryRunner.setState({
          datasource: getDataSourceRef(dsSettings),
        });
      }

      console.error(err);
    }
  }

  public changePluginType(pluginId: string) {
    const panel = this.getPanel();
    const { options: prevOptions, fieldConfig: prevFieldConfig, pluginId: prevPluginId } = panel.state;

    // clear custom options
    let newFieldConfig: FieldConfigSource = {
      defaults: {
        ...prevFieldConfig.defaults,
        custom: {},
      },
      overrides: filterFieldConfigOverrides(prevFieldConfig.overrides, isStandardFieldProp),
    };

    this._cachedPluginOptions[prevPluginId] = { options: prevOptions, fieldConfig: prevFieldConfig };

    const cachedOptions = this._cachedPluginOptions[pluginId]?.options;
    const cachedFieldConfig = this._cachedPluginOptions[pluginId]?.fieldConfig;

    if (cachedFieldConfig) {
      newFieldConfig = restoreCustomOverrideRules(newFieldConfig, cachedFieldConfig);
    }

    // When changing from non-data to data panel, we need to add a new data provider
    if (!this.getPanel().state.$data && !config.panels[pluginId].skipDataQuery) {
      let ds = getLastUsedDatasourceFromStorage(getDashboardSceneFor(this).state.uid!)?.datasourceUid;

      if (!ds) {
        ds = config.defaultDatasource;
      }

      panel.setState({
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

    this.setState({
      pluginId,
    });

    panel.changePluginType(pluginId, cachedOptions, newFieldConfig);

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
      datasource: getDataSourceRef(newSettings),
      queries,
    });
    if (defaultQueries) {
      queryRunner.runQueries();
    }

    this.loadDataSource();
  }

  public changeQueryOptions(options: QueryGroupOptions) {
    const panel = this.getPanel();
    const dataObj = this.queryRunner;
    const timeRangeObj = panel.state.$timeRange;

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
        panel.setState({ $timeRange: undefined });
      }
    } else {
      // no time override present on the panel, let's create one first
      panel.setState({ $timeRange: new PanelTimeRange(timeRangeObjStateUpdate) });
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
    const panel = this.getPanel();
    const panelId = getPanelIdForVizPanel(panel);

    locationService.partial({
      inspect: panelId,
      inspectTab: 'query',
    });
  }

  get queryRunner(): SceneQueryRunner {
    // Panel data object is always SceneQueryRunner wrapped in a SceneDataTransformer
    const runner = getQueryRunnerFor(this.getPanel());

    if (!runner) {
      throw new Error('Query runner not found');
    }

    return runner;
  }

  get dataTransformer(): SceneDataTransformer {
    const provider = this.getPanel().state.$data;
    if (!provider || !(provider instanceof SceneDataTransformer)) {
      throw new Error('Could not find SceneDataTransformer for panel');
    }
    return provider;
  }

  public toggleTableView() {
    if (this.state.tableView) {
      this.setState({ tableView: undefined });
      return;
    }

    this.setState({
      tableView: PanelBuilders.table()
        .setTitle('')
        .setOption('showTypeIcons', true)
        .setOption('showHeader', true)
        // Here we are breaking a scene rule and changing the parent of the main panel data provider
        // But we need to share this same instance as the queries tab is subscribing to it
        .setData(this.dataTransformer)
        .build(),
    });
  }

  public unlinkLibraryPanel() {
    const panel = this.getPanel();
    if (!isLibraryPanel(panel)) {
      throw new Error('VizPanel is not a library panel');
    }

    const libPanelBehavior = getLibraryPanelBehavior(panel);

    this.state.panelRef
      .resolve()
      .setState({ $behaviors: panel.state.$behaviors!.filter((b) => b !== libPanelBehavior) });
  }

  public saveLibPanel() {
    if (isLibraryPanel(this.getPanel())) {
      saveLibPanel(this.getPanel());
    }
  }

  public setPanelTitle(newTitle: string) {
    this.getPanel().setState({ title: newTitle, hoverHeader: newTitle === '' });
  }

  public static Component = ({ model }: SceneComponentProps<VizPanelManager>) => {
    const { panelRef, tableView } = model.useState();
    const panel = panelRef.resolve();
    const styles = useStyles2(getStyles);
    const panelToShow = tableView ?? panel;
    const dataProvider = panelToShow.state.$data;

    // This is to preserve SceneQueryRunner stays alive when switching between visualizations and table view
    useEffect(() => {
      return dataProvider?.activate();
    }, [dataProvider]);

    return (
      <>
        <div className={styles.wrapper}>{<panelToShow.Component model={panelToShow} />}</div>
      </>
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
