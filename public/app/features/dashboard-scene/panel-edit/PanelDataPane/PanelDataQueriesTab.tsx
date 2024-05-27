import React from 'react';

import { CoreApp, DataSourceApi, DataSourceInstanceSettings, IconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { SceneObjectBase, SceneComponentProps, sceneGraph, SceneQueryRunner } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { Button, Stack, Tab } from '@grafana/ui';
import { addQuery } from 'app/core/utils/query';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { GroupActionComponents } from 'app/features/query/components/QueryActionComponent';
import { QueryEditorRows } from 'app/features/query/components/QueryEditorRows';
import { QueryGroupTopSection } from 'app/features/query/components/QueryGroup';
import { isSharedDashboardQuery } from 'app/plugins/datasource/dashboard';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { QueryGroupOptions } from 'app/types';

import { PanelTimeRange } from '../../scene/PanelTimeRange';
import { VizPanelManager } from '../VizPanelManager';

import { PanelDataPaneTabState, PanelDataPaneTab, TabId, PanelDataTabHeaderProps } from './types';

interface PanelDataQueriesTabState extends PanelDataPaneTabState {
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
}
export class PanelDataQueriesTab extends SceneObjectBase<PanelDataQueriesTabState> implements PanelDataPaneTab {
  static Component = PanelDataQueriesTabRendered;
  TabComponent: (props: PanelDataTabHeaderProps) => React.JSX.Element;

  tabId = TabId.Queries;
  icon: IconName = 'database';
  private _panelManager: VizPanelManager;

  getTabLabel() {
    return 'Queries';
  }

  getItemsCount() {
    return this.getQueries().length;
  }

  constructor(panelManager: VizPanelManager) {
    super({});

    this.TabComponent = (props: PanelDataTabHeaderProps) => {
      return QueriesTab({ ...props, model: this });
    };

    this._panelManager = panelManager;
  }

  buildQueryOptions(): QueryGroupOptions {
    const panelManager = this._panelManager;
    const panelObj = this._panelManager.state.panel;
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

    let queries: QueryGroupOptions['queries'] = queryRunner.state.queries;

    return {
      cacheTimeout: panelManager.state.dsSettings?.meta.queryOptions?.cacheTimeout
        ? queryRunner.state.cacheTimeout
        : undefined,
      queryCachingTTL: panelManager.state.dsSettings?.cachingConfig?.enabled
        ? queryRunner.state.queryCachingTTL
        : undefined,
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
    return this._panelManager.queryRunner.state.queries;
  }

  newQuery(): Partial<DataQuery> {
    const { dsSettings, datasource } = this._panelManager.state;

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

  addQueryClick = () => {
    const queries = this.getQueries();
    this.onQueriesChange(addQuery(queries, this.newQuery()));
  };

  onAddQuery = (query: Partial<DataQuery>) => {
    const queries = this.getQueries();
    const dsSettings = this._panelManager.state.dsSettings;
    this.onQueriesChange(addQuery(queries, query, { type: dsSettings?.type, uid: dsSettings?.uid }));
  };

  isExpressionsSupported(dsSettings: DataSourceInstanceSettings): boolean {
    return (dsSettings.meta.alerting || dsSettings.meta.mixed) === true;
  }

  onAddExpressionClick = () => {
    const queries = this.getQueries();
    this.onQueriesChange(addQuery(queries, expressionDatasource.newQuery()));
  };

  renderExtraActions() {
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

  get queryRunner(): SceneQueryRunner {
    return this._panelManager.queryRunner;
  }

  get panelManager() {
    return this._panelManager;
  }
}

export function PanelDataQueriesTabRendered({ model }: SceneComponentProps<PanelDataQueriesTab>) {
  const { datasource, dsSettings } = model.panelManager.useState();
  const { data, queries } = model.panelManager.queryRunner.useState();

  if (!datasource || !dsSettings || !data) {
    return null;
  }

  const showAddButton = !isSharedDashboardQuery(dsSettings.name);

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
      />

      <Stack gap={2}>
        {showAddButton && (
          <Button
            icon="plus"
            onClick={model.addQueryClick}
            variant="secondary"
            data-testid={selectors.components.QueryTab.addQuery}
          >
            Add query
          </Button>
        )}
        {config.expressionsEnabled && model.isExpressionsSupported(dsSettings) && (
          <Button
            icon="plus"
            onClick={model.onAddExpressionClick}
            variant="secondary"
            data-testid={selectors.components.QueryTab.addExpression}
          >
            <span>Expression&nbsp;</span>
          </Button>
        )}
        {model.renderExtraActions()}
      </Stack>
    </div>
  );
}

interface QueriesTabProps extends PanelDataTabHeaderProps {
  model: PanelDataQueriesTab;
}

function QueriesTab(props: QueriesTabProps) {
  const { model } = props;

  const queryRunnerState = model.queryRunner.useState();

  return (
    <Tab
      key={props.key}
      label={model.getTabLabel()}
      icon="database"
      counter={queryRunnerState.queries.length}
      active={props.active}
      onChangeTab={props.onChangeTab}
    />
  );
}
