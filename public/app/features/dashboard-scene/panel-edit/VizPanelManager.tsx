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
  LocalValueVariable,
  MultiValueVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneDataTransformer,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectStateChangedEvent,
  SceneQueryRunner,
  SceneVariableSet,
  SceneVariables,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import { DataQuery, DataTransformerConfig, Panel } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { getLastUsedDatasourceFromStorage } from 'app/features/dashboard/utils/dashboard';
import { storeLastUsedDataSourceInLocalStorage } from 'app/features/datasources/components/picker/utils';
import { updateLibraryVizPanel } from 'app/features/library-panels/state/api';
import { updateQueries } from 'app/features/query/state/updateQueries';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { QueryGroupOptions } from 'app/types';

import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { getPanelChanges } from '../saving/getDashboardChanges';
import { DashboardGridItem, RepeatDirection } from '../scene/DashboardGridItem';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { PanelTimeRange, PanelTimeRangeState } from '../scene/PanelTimeRange';
import { gridItemToPanel, vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { getDashboardSceneFor, getMultiVariableValues, getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';

export interface VizPanelManagerState extends SceneObjectState {
  panel: VizPanel;
  sourcePanel: SceneObjectRef<VizPanel>;
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

  public constructor(state: VizPanelManagerState) {
    super(state);
    this.addActivationHandler(() => this._onActivate());
  }

  /**
   * Will clone the source panel and move the data provider to
   * live on the VizPanelManager level instead of the VizPanel level
   */
  public static createFor(sourcePanel: VizPanel) {
    let repeatOptions: Pick<VizPanelManagerState, 'repeat' | 'repeatDirection' | 'maxPerRow'> = {};

    const gridItem = sourcePanel.parent instanceof LibraryVizPanel ? sourcePanel.parent.parent : sourcePanel.parent;

    if (!(gridItem instanceof DashboardGridItem)) {
      console.error('VizPanel is not a child of a dashboard grid item');
      throw new Error('VizPanel is not a child of a dashboard grid item');
    }

    const { variableName: repeat, repeatDirection, maxPerRow } = gridItem.state;
    repeatOptions = { repeat, repeatDirection, maxPerRow };

    let variables: SceneVariables | undefined;

    if (gridItem.parent?.state.$variables) {
      variables = gridItem.parent.state.$variables.clone();
    }

    if (repeatOptions.repeat) {
      const variable = sceneGraph.lookupVariable(repeatOptions.repeat, gridItem);

      if (variable instanceof MultiValueVariable && variable.state.value.length) {
        const { values, texts } = getMultiVariableValues(variable);

        const varWithDefaultValue = new LocalValueVariable({
          name: variable.state.name,
          value: values[0],
          text: String(texts[0]),
        });

        if (!variables) {
          variables = new SceneVariableSet({
            variables: [varWithDefaultValue],
          });
        } else {
          variables.setState({ variables: [varWithDefaultValue] });
        }
      }
    }

    return new VizPanelManager({
      $variables: variables,
      panel: sourcePanel.clone(),
      sourcePanel: sourcePanel.getRef(),
      pluginId: sourcePanel.state.pluginId,
      ...repeatOptions,
    });
  }

  private _onActivate() {
    this.loadDataSource();
    const changesSub = this.subscribeToEvent(SceneObjectStateChangedEvent, this._handleStateChange);

    return () => {
      changesSub.unsubscribe();
    };
  }

  private _detectPanelModelChanges = debounce(() => {
    const { hasChanges } = getPanelChanges(
      vizPanelToPanel(this.state.sourcePanel.resolve()),
      vizPanelToPanel(this.state.panel)
    );
    this.setState({ isDirty: hasChanges });
  }, 250);

  private _handleStateChange = (event: SceneObjectStateChangedEvent) => {
    if (DashboardSceneChangeTracker.isUpdatingPersistedState(event)) {
      this._detectPanelModelChanges();
    }
  };

  private async loadDataSource() {
    const dataObj = this.state.panel.state.$data;

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
    const { options: prevOptions, fieldConfig: prevFieldConfig, pluginId: prevPluginId } = this.state.panel.state;

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
    if (!this.state.panel.state.$data && !config.panels[pluginId].skipDataQuery) {
      let ds = getLastUsedDatasourceFromStorage(getDashboardSceneFor(this).state.uid!)?.datasourceUid;

      if (!ds) {
        ds = config.defaultDatasource;
      }

      this.state.panel.setState({
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

    this.state.panel.changePluginType(pluginId, cachedOptions, newFieldConfig);

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
    const panelObj = this.state.panel;
    const dataObj = this.queryRunner;
    const timeRangeObj = panelObj.state.$timeRange;

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
    const sourcePanel = this.state.sourcePanel.resolve();
    if (!(sourcePanel.parent instanceof LibraryVizPanel)) {
      throw new Error('VizPanel is not a child of a library panel');
    }

    const gridItem = sourcePanel.parent.parent;

    if (!(gridItem instanceof DashboardGridItem)) {
      throw new Error('Library panel not a child of a grid item');
    }

    const newSourcePanel = this.state.panel.clone({ $data: this.state.$data?.clone() });
    gridItem.setState({
      body: newSourcePanel,
    });

    this.setState({ sourcePanel: newSourcePanel.getRef() });
  }

  public commitChanges() {
    const sourcePanel = this.state.sourcePanel.resolve();
    this.commitChangesTo(sourcePanel);
  }

  public commitChangesTo(sourcePanel: VizPanel) {
    const repeatUpdate = {
      variableName: this.state.repeat,
      repeatDirection: this.state.repeatDirection,
      maxPerRow: this.state.maxPerRow,
    };

    if (sourcePanel.parent instanceof DashboardGridItem) {
      sourcePanel.parent.setState({
        ...repeatUpdate,
        body: this.state.panel.clone(),
      });
    }

    if (sourcePanel.parent instanceof LibraryVizPanel) {
      if (sourcePanel.parent.parent instanceof DashboardGridItem) {
        const newLibPanel = sourcePanel.parent.clone({
          panel: this.state.panel.clone(),
        });

        sourcePanel.parent.parent.setState({
          body: newLibPanel,
          ...repeatUpdate,
        });

        updateLibraryVizPanel(newLibPanel!).then((p) => {
          if (sourcePanel.parent instanceof LibraryVizPanel) {
            newLibPanel.setPanelFromLibPanel(p);
          }
        });
      }
    }
  }

  /**
   * Used from inspect json tab to view the current persisted model
   */
  public getPanelSaveModel(): Panel | object {
    const sourcePanel = this.state.sourcePanel.resolve();

    const isLibraryPanel = sourcePanel.parent instanceof LibraryVizPanel;
    const gridItem = isLibraryPanel ? sourcePanel.parent.parent : sourcePanel.parent;

    if (!(gridItem instanceof DashboardGridItem)) {
      return { error: 'Unsupported panel parent' };
    }

    const parentClone = gridItem.clone({
      body: this.state.panel.clone(),
    });

    return gridItemToPanel(parentClone);
  }

  public setPanelTitle(newTitle: string) {
    this.state.panel.setState({ title: newTitle, hoverHeader: newTitle === '' });
  }

  public static Component = ({ model }: SceneComponentProps<VizPanelManager>) => {
    const { panel, tableView } = model.useState();
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
