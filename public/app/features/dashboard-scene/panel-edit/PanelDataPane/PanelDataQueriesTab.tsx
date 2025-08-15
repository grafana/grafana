import { CoreApp, DataSourceApi, DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { config, getDataSourceSrv, locationService } from '@grafana/runtime';
import {
  SceneObjectBase,
  SceneComponentProps,
  sceneGraph,
  SceneQueryRunner,
  SceneObjectRef,
  VizPanel,
  SceneObjectState,
  SceneDataQuery,
} from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { Button, Stack, Tab } from '@grafana/ui';
import { addQuery } from 'app/core/utils/query';
import { getLastUsedDatasourceFromStorage } from 'app/features/dashboard/utils/dashboard';
import { storeLastUsedDataSourceInLocalStorage } from 'app/features/datasources/components/picker/utils';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { ExpressionTypeDropdown } from 'app/features/expressions/components/ExpressionTypeDropdown';
import { ExpressionQueryType } from 'app/features/expressions/types';
import { getDefaults } from 'app/features/expressions/utils/expressionTypes';
import { InspectTab } from 'app/features/inspector/types';
import { GroupActionComponents } from 'app/features/query/components/QueryActionComponent';
import { QueryEditorRows } from 'app/features/query/components/QueryEditorRows';
import { QueryGroupTopSection } from 'app/features/query/components/QueryGroup';
import { updateQueries } from 'app/features/query/state/updateQueries';
import { isSharedDashboardQuery } from 'app/plugins/datasource/dashboard/runSharedRequest';
import { QueryGroupOptions } from 'app/types/query';

import { MIXED_DATASOURCE_NAME } from '../../../../plugins/datasource/mixed/MixedDataSource';
import { useQueryLibraryContext } from '../../../explore/QueryLibrary/QueryLibraryContext';
import { ExpressionDatasourceUID } from '../../../expressions/types';
import { getDatasourceSrv } from '../../../plugins/datasource_srv';
import { PanelInspectDrawer } from '../../inspect/PanelInspectDrawer';
import { PanelTimeRange } from '../../scene/PanelTimeRange';
import { getDashboardSceneFor, getPanelIdForVizPanel, getQueryRunnerFor } from '../../utils/utils';
import { getUpdatedHoverHeader } from '../getPanelFrameOptions';

import { PanelDataPaneTab, TabId, PanelDataTabHeaderProps } from './types';

interface PanelDataQueriesTabState extends SceneObjectState {
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
  panelRef: SceneObjectRef<VizPanel>;
}
export class PanelDataQueriesTab extends SceneObjectBase<PanelDataQueriesTabState> implements PanelDataPaneTab {
  static Component = PanelDataQueriesTabRendered;
  tabId = TabId.Queries;

  public constructor(state: PanelDataQueriesTabState) {
    super(state);
    this.addActivationHandler(() => this.onActivate());
  }

  public getTabLabel() {
    return t('dashboard-scene.panel-data-queries-tab.tab-label', 'Queries');
  }

  public getItemsCount() {
    return this.getQueries().length;
  }

  public renderTab(props: PanelDataTabHeaderProps) {
    return <QueriesTab key={this.getTabLabel()} model={this} {...props} />;
  }

  private onActivate() {
    this.loadDataSource();
  }

  private async loadDataSource() {
    const panel = this.state.panelRef.resolve();
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

  public buildQueryOptions(): QueryGroupOptions {
    const panel = this.state.panelRef.resolve();
    const queryRunner = getQueryRunnerFor(panel)!;
    const timeRangeObj = sceneGraph.getTimeRange(panel);

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

    let queries: QueryGroupOptions['queries'] = queryRunner.state.queries;
    const dsSettings = this.state.dsSettings;

    return {
      cacheTimeout: dsSettings?.meta.queryOptions?.cacheTimeout ? queryRunner.state.cacheTimeout : undefined,
      queryCachingTTL: dsSettings?.cachingConfig?.enabled ? queryRunner.state.queryCachingTTL : undefined,
      dataSource: {
        default: dsSettings?.isDefault,
        ...(dsSettings ? getDataSourceRef(dsSettings) : { type: undefined, uid: undefined }),
      },
      queries,
      maxDataPoints: queryRunner.state.maxDataPoints,
      minInterval: queryRunner.state.minInterval,
      timeRange: timeRangeOpts,
    };
  }

  public onOpenInspector = () => {
    const dashboard = getDashboardSceneFor(this);
    dashboard.showModal(new PanelInspectDrawer({ panelRef: this.state.panelRef, currentTab: InspectTab.Query }));
  };

  public onChangeDataSource = async (newSettings: DataSourceInstanceSettings, defaultQueries?: SceneDataQuery[]) => {
    const { dsSettings } = this.state;
    const queryRunner = this.queryRunner;

    const currentDS = dsSettings ? await getDataSourceSrv().get({ uid: dsSettings.uid }) : undefined;
    const nextDS = await getDataSourceSrv().get({ uid: newSettings.uid });

    const currentQueries = queryRunner.state.queries;

    // We need to pass in newSettings.uid as well here as that can be a variable expression and we want to store that in the query model not the current ds variable value
    const queries = defaultQueries || (await updateQueries(nextDS, newSettings.uid, currentQueries, currentDS));

    queryRunner.setState({ datasource: getDataSourceRef(newSettings), queries });

    if (defaultQueries) {
      queryRunner.runQueries();
    }

    this.loadDataSource();
  };

  public onQueryOptionsChange = (options: QueryGroupOptions) => {
    const panel = this.state.panelRef.resolve();
    const dataObj = this.queryRunner;

    const dataObjStateUpdate: Partial<SceneQueryRunner['state']> = {};
    const panelStateUpdate: Partial<VizPanel['state']> = {};

    if (options.maxDataPoints !== dataObj.state.maxDataPoints) {
      dataObjStateUpdate.maxDataPoints = options.maxDataPoints ?? undefined;
    }

    if (options.minInterval !== dataObj.state.minInterval) {
      dataObjStateUpdate.minInterval = options.minInterval ?? undefined;
    }

    const timeFrom = options.timeRange?.from ?? undefined;
    const timeShift = options.timeRange?.shift ?? undefined;
    const hideTimeOverride = options.timeRange?.hide;

    if (timeFrom !== undefined || timeShift !== undefined) {
      panelStateUpdate.$timeRange = new PanelTimeRange({ timeFrom, timeShift, hideTimeOverride });
      panelStateUpdate.hoverHeader = getUpdatedHoverHeader(panel.state.title, panelStateUpdate.$timeRange);
    } else {
      panelStateUpdate.$timeRange = undefined;
      panelStateUpdate.hoverHeader = getUpdatedHoverHeader(panel.state.title, undefined);
    }

    if (options.cacheTimeout !== dataObj?.state.cacheTimeout) {
      dataObjStateUpdate.cacheTimeout = options.cacheTimeout;
    }

    if (options.queryCachingTTL !== dataObj?.state.queryCachingTTL) {
      dataObjStateUpdate.queryCachingTTL = options.queryCachingTTL;
    }

    panel.setState(panelStateUpdate);

    dataObj.setState(dataObjStateUpdate);
    dataObj.runQueries();
  };

  public onQueriesChange = (queries: SceneDataQuery[]) => {
    const runner = this.queryRunner;
    runner.setState({ queries });
  };

  public onRunQueries = () => {
    this.queryRunner.runQueries();
  };

  public getQueries() {
    return this.queryRunner.state.queries;
  }

  public newQuery(): Partial<DataQuery> {
    const { dsSettings, datasource } = this.state;
    let ds;

    if (!dsSettings?.meta.mixed) {
      ds = dsSettings; // Use dsSettings if it is not mixed
    } else if (!datasource?.meta.mixed) {
      ds = datasource; // Use datasource if dsSettings is mixed but datasource is not
    } else {
      // Use default datasource if both are mixed or just datasource is mixed
      ds = getDataSourceSrv().getInstanceSettings(config.defaultDatasource);
    }

    return {
      ...datasource?.getDefaultQuery?.(CoreApp.PanelEditor),
      datasource: { uid: ds?.uid, type: ds?.type },
    };
  }

  public addQueryClick = () => {
    const queries = this.getQueries();
    this.onQueriesChange(addQuery(queries, this.newQuery()));
  };

  public onAddQuery = (query: Partial<DataQuery>) => {
    const queries = this.getQueries();
    const dsSettings = this.state.dsSettings;

    this.onQueriesChange(
      addQuery(queries, query, dsSettings ? getDataSourceRef(dsSettings) : { type: undefined, uid: undefined })
    );
  };

  public isExpressionsSupported(dsSettings: DataSourceInstanceSettings): boolean {
    return (dsSettings.meta.backend || dsSettings.meta.alerting || dsSettings.meta.mixed) === true;
  }

  public onAddExpressionOfType = (type: ExpressionQueryType) => {
    const queries = this.getQueries();
    // Create base expression query with the specified type
    const baseQuery = expressionDatasource.newQuery();
    const queryWithType = { ...baseQuery, type };
    // Apply defaults specific to the expression type
    const queryWithDefaults = getDefaults(queryWithType);

    this.onQueriesChange(addQuery(queries, queryWithDefaults));
  };

  public renderExtraActions() {
    return GroupActionComponents.getAllExtraRenderAction()
      .map((action, index) =>
        action({
          onAddQuery: this.onAddQuery,
          onChangeDataSource: this.onChangeDataSource,
          key: index,
        })
      )
      .filter(Boolean);
  }

  public get queryRunner(): SceneQueryRunner {
    return getQueryRunnerFor(this.state.panelRef.resolve())!;
  }
}

export function PanelDataQueriesTabRendered({ model }: SceneComponentProps<PanelDataQueriesTab>) {
  const { datasource, dsSettings } = model.useState();
  const { data, queries } = model.queryRunner.useState();
  const { openDrawer: openQueryLibraryDrawer, queryLibraryEnabled } = useQueryLibraryContext();

  if (!datasource || !dsSettings || !data) {
    return null;
  }

  const showAddButton = !isSharedDashboardQuery(dsSettings.name);
  const onSelectQueryFromLibrary = async (query: DataQuery) => {
    // ensure all queries explicitly define a datasource
    const enrichedQueries = queries.map((q) =>
      q.datasource
        ? q
        : {
            ...q,
            datasource: datasource.getRef(),
          }
    );
    const newQueries = addQuery(enrichedQueries, query);
    model.onQueriesChange(newQueries);
    if (query.datasource?.uid) {
      const uniqueDatasources = new Set(
        newQueries.map((q) => q.datasource?.uid).filter((uid) => uid !== ExpressionDatasourceUID)
      );
      const isMixed = uniqueDatasources.size > 1;
      const newDatasourceRef = {
        uid: isMixed ? MIXED_DATASOURCE_NAME : query.datasource.uid,
      };
      const shouldChangeDatasource = datasource.uid !== newDatasourceRef.uid;
      if (shouldChangeDatasource) {
        const newDatasource = getDatasourceSrv().getInstanceSettings(newDatasourceRef);
        if (newDatasource) {
          await model.onChangeDataSource(newDatasource);
        }
      }
    }
  };

  return (
    <div data-testid={selectors.components.QueryTab.content}>
      <QueryGroupTopSection
        data={data}
        dsSettings={dsSettings}
        dataSource={datasource}
        options={model.buildQueryOptions()}
        onDataSourceChange={model.onChangeDataSource}
        onOptionsChange={model.onQueryOptionsChange}
        onOpenQueryInspector={model.onOpenInspector}
      />

      <QueryEditorRows
        data={data}
        queries={queries}
        dsSettings={dsSettings}
        onAddQuery={model.onAddQuery}
        onQueriesChange={model.onQueriesChange}
        onRunQueries={model.onRunQueries}
        app={CoreApp.PanelEditor}
      />

      <Stack gap={2}>
        {showAddButton && (
          <>
            <Button
              icon="plus"
              onClick={model.addQueryClick}
              variant="secondary"
              data-testid={selectors.components.QueryTab.addQuery}
            >
              <Trans i18nKey="dashboard-scene.panel-data-queries-tab-rendered.add-query">Add query</Trans>
            </Button>
            {queryLibraryEnabled && (
              <Button
                icon="plus"
                onClick={() =>
                  openQueryLibraryDrawer(getDatasourceNames(datasource, queries), onSelectQueryFromLibrary, {
                    context: CoreApp.PanelEditor,
                  })
                }
                variant="secondary"
                data-testid={selectors.components.QueryTab.addQueryFromLibrary}
              >
                <Trans i18nKey={'dashboards.panel-queries.add-query-from-library'}>Add query from library</Trans>
              </Button>
            )}
          </>
        )}
        {config.expressionsEnabled && model.isExpressionsSupported(dsSettings) && (
          <ExpressionTypeDropdown handleOnSelect={model.onAddExpressionOfType}>
            <Button icon="plus" variant="secondary" data-testid={selectors.components.QueryTab.addExpression}>
              <Trans i18nKey="dashboard-scene.panel-data-queries-tab-rendered.expression">Expression&nbsp;</Trans>
            </Button>
          </ExpressionTypeDropdown>
        )}
        {model.renderExtraActions()}
      </Stack>
    </div>
  );
}

function getDatasourceNames(datasource: DataSourceApi, queries: DataQuery[]): string[] {
  if (datasource.uid === '-- Mixed --') {
    // If datasource is mixed, the datasource UID is on the query. Here we map the UIDs to datasource names.
    const dsSrv = getDataSourceSrv();
    return queries.map((ds) => dsSrv.getInstanceSettings(ds.datasource)?.name).filter((name) => name !== undefined);
  } else {
    return [datasource.name];
  }
}

interface QueriesTabProps extends PanelDataTabHeaderProps {
  model: PanelDataQueriesTab;
}

function QueriesTab(props: QueriesTabProps) {
  const { model } = props;

  const queryRunnerState = model.queryRunner.useState();

  return (
    <Tab
      label={model.getTabLabel()}
      icon="database"
      counter={queryRunnerState.queries.length}
      active={props.active}
      onChangeTab={props.onChangeTab}
    />
  );
}
