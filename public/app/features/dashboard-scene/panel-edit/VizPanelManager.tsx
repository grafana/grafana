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
  DeepPartial,
  PanelBuilders,
  SceneComponentProps,
  SceneDataTransformer,
  SceneGridItem,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
  sceneGraph,
  sceneUtils,
} from '@grafana/scenes';
import { DataQuery, DataTransformerConfig, Panel } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { getPluginVersion } from 'app/features/dashboard/state/PanelModel';
import { getLastUsedDatasourceFromStorage } from 'app/features/dashboard/utils/dashboard';
import { storeLastUsedDataSourceInLocalStorage } from 'app/features/datasources/components/picker/utils';
import { updateLibraryVizPanel } from 'app/features/library-panels/state/api';
import { updateQueries } from 'app/features/query/state/updateQueries';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { QueryGroupOptions } from 'app/types';

import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { PanelRepeaterGridItem, RepeatDirection } from '../scene/PanelRepeaterGridItem';
import { PanelTimeRange, PanelTimeRangeState } from '../scene/PanelTimeRange';
import { gridItemToPanel } from '../serialization/transformSceneToSaveModel';
import { getDashboardSceneFor, getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';

export interface VizPanelManagerState extends SceneObjectState {
  panel: VizPanel;
  sourcePanel: SceneObjectRef<VizPanel>;
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
  tableView?: VizPanel;
  repeat?: string;
  repeatDirection?: RepeatDirection;
  maxPerRow?: number;
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
    if (sourcePanel.parent instanceof PanelRepeaterGridItem) {
      const { variableName: repeat, repeatDirection, maxPerRow } = sourcePanel.parent.state;
      repeatOptions = { repeat, repeatDirection, maxPerRow };
    }

    return new VizPanelManager({
      panel: sourcePanel.clone({ $data: undefined }),
      $data: sourcePanel.state.$data?.clone(),
      sourcePanel: sourcePanel.getRef(),
      ...repeatOptions,
    });
  }

  private _onActivate() {
    this.loadDataSource();
  }

  private async loadDataSource() {
    const dataObj = this.state.$data;

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

  public changePluginType(pluginId: string) {
    const {
      options: prevOptions,
      fieldConfig: prevFieldConfig,
      pluginId: prevPluginId,
      ...restOfOldState
    } = sceneUtils.cloneSceneObjectState(this.state.panel.state);

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

    const newPanel = new VizPanel({
      options: cachedOptions ?? {},
      fieldConfig: newFieldConfig,
      pluginId: pluginId,
      ...restOfOldState,
    });

    // When changing from non-data to data panel, we need to add a new data provider
    if (!this.state.$data && !config.panels[pluginId].skipDataQuery) {
      let ds = getLastUsedDatasourceFromStorage(getDashboardSceneFor(this).state.uid!)?.datasourceUid;

      if (!ds) {
        ds = config.defaultDatasource;
      }

      this.setState({
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
      type: pluginId,
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
    const runner = getQueryRunnerFor(this);

    if (!runner) {
      throw new Error('Query runner not found');
    }

    return runner;
  }

  get dataTransformer(): SceneDataTransformer {
    const provider = this.state.$data;
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
        .build(),
    });
  }

  public unlinkLibraryPanel() {
    const sourcePanel = this.state.sourcePanel.resolve();
    if (!(sourcePanel.parent instanceof LibraryVizPanel)) {
      throw new Error('VizPanel is not a child of a library panel');
    }

    const gridItem = sourcePanel.parent.parent;
    if (!(gridItem instanceof SceneGridItem)) {
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

    if (sourcePanel.parent instanceof SceneGridItem) {
      sourcePanel.parent.setState({
        body: this.state.panel.clone({
          $data: this.state.$data?.clone(),
        }),
      });
    }

    if (sourcePanel.parent instanceof LibraryVizPanel) {
      if (sourcePanel.parent.parent instanceof SceneGridItem) {
        const newLibPanel = sourcePanel.parent.clone({
          panel: this.state.panel.clone({
            $data: this.state.$data?.clone(),
          }),
        });
        sourcePanel.parent.parent.setState({
          body: newLibPanel,
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

    if (sourcePanel.parent instanceof SceneGridItem) {
      const parentClone = sourcePanel.parent.clone({
        body: this.state.panel.clone({
          $data: this.state.$data?.clone(),
        }),
      });

      return gridItemToPanel(parentClone);
    }

    return { error: 'Unsupported panel parent' };
  }

  public getPanelCloneWithData(): VizPanel {
    return this.state.panel.clone({ $data: this.state.$data?.clone() });
  }

  public static Component = ({ model }: SceneComponentProps<VizPanelManager>) => {
    const { panel, tableView } = model.useState();
    const styles = useStyles2(getStyles);

    const panelToShow = tableView ?? panel;

    return <div className={styles.wrapper}>{<panelToShow.Component model={panelToShow} />}</div>;
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
