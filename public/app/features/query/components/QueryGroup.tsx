// Libraries
import React, { PureComponent } from 'react';
// Components
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { Button, CustomScrollbar, HorizontalGroup, Modal, stylesFactory, Field } from '@grafana/ui';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryEditorRows } from './QueryEditorRows';
// Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import config from 'app/core/config';
// Types
import {
  DataQuery,
  DataSourceSelectItem,
  DefaultTimeRange,
  LoadingState,
  PanelData,
  DataSourceApi,
} from '@grafana/data';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import { addQuery } from 'app/core/utils/query';
import { Unsubscribable } from 'rxjs';
import { expressionDatasource, ExpressionDatasourceID } from 'app/features/expressions/ExpressionDatasource';
import { selectors } from '@grafana/e2e-selectors';
import { PanelQueryRunner } from '../state/PanelQueryRunner';
import { QueryGroupOptions, QueryGroupOptionsEditor } from './QueryGroupOptions';
import { DashboardQueryEditor, isSharedDashboardQuery } from 'app/plugins/datasource/dashboard';
import { css } from 'emotion';

interface Props {
  queryRunner: PanelQueryRunner;
  queries: DataQuery[];
  dataSourceName: string | null;
  options: QueryGroupOptions;
  onOpenQueryInspector?: () => void;
  onRunQueries: () => void;
  onQueriesChange: (queries: DataQuery[]) => void;
  onDataSourceChange: (ds: DataSourceSelectItem, queries: DataQuery[]) => void;
  onOptionsChange: (options: QueryGroupOptions) => void;
}

interface State {
  dataSource?: DataSourceApi;
  dataSourceItem: DataSourceSelectItem;
  dataSourceError?: string;
  helpContent: React.ReactNode;
  isLoadingHelp: boolean;
  isPickerOpen: boolean;
  isAddingMixed: boolean;
  scrollTop: number;
  data: PanelData;
  isHelpOpen: boolean;
}

export class QueryGroup extends PureComponent<Props, State> {
  datasources: DataSourceSelectItem[] = getDatasourceSrv().getMetricSources();
  backendSrv = backendSrv;
  querySubscription: Unsubscribable | null;

  state: State = {
    isLoadingHelp: false,
    dataSourceItem: this.findCurrentDataSource(this.props.dataSourceName),
    helpContent: null,
    isPickerOpen: false,
    isAddingMixed: false,
    isHelpOpen: false,
    scrollTop: 0,
    data: {
      state: LoadingState.NotStarted,
      series: [],
      timeRange: DefaultTimeRange,
    },
  };

  async componentDidMount() {
    const { queryRunner, dataSourceName: datasourceName } = this.props;

    this.querySubscription = queryRunner.getData({ withTransforms: false, withFieldConfig: false }).subscribe({
      next: (data: PanelData) => this.onPanelDataUpdate(data),
    });

    try {
      const ds = await getDataSourceSrv().get(datasourceName);
      this.setState({ dataSource: ds });
    } catch (error) {
      const ds = await getDataSourceSrv().get();
      const dataSourceItem = this.findCurrentDataSource(ds.name);
      this.setState({ dataSource: ds, dataSourceError: error?.message, dataSourceItem });
    }
  }

  componentWillUnmount() {
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
      this.querySubscription = null;
    }
  }

  onPanelDataUpdate(data: PanelData) {
    this.setState({ data });
  }

  findCurrentDataSource(dataSourceName: string | null): DataSourceSelectItem {
    return this.datasources.find(datasource => datasource.value === dataSourceName) || this.datasources[0];
  }

  onChangeDataSource = async (newDsItem: DataSourceSelectItem) => {
    let { queries } = this.props;
    const { dataSourceItem } = this.state;

    // switching to mixed
    if (newDsItem.meta.mixed) {
      for (const query of queries) {
        if (query.datasource !== ExpressionDatasourceID) {
          query.datasource = query.datasource;
          if (!query.datasource) {
            query.datasource = config.defaultDatasource;
          }
        }
      }
    } else if (dataSourceItem) {
      // if switching from mixed
      if (dataSourceItem.meta.mixed) {
        // Remove the explicit datasource
        for (const query of queries) {
          if (query.datasource !== ExpressionDatasourceID) {
            delete query.datasource;
          }
        }
      } else if (dataSourceItem.meta.id !== newDsItem.meta.id) {
        // we are changing data source type, clear queries
        queries = [{ refId: 'A' }];
      }
    }

    const dataSource = await getDataSourceSrv().get(newDsItem.value);

    this.props.onDataSourceChange(newDsItem, queries);

    this.setState({
      dataSourceItem: newDsItem,
      dataSource: dataSource,
      dataSourceError: undefined,
    });
  };

  onAddQueryClick = () => {
    if (this.state.dataSourceItem.meta.mixed) {
      this.setState({ isAddingMixed: true });
      return;
    }

    this.props.onQueriesChange(addQuery(this.props.queries));
    this.onScrollBottom();
  };

  onAddExpressionClick = () => {
    this.props.onQueriesChange(addQuery(this.props.queries, expressionDatasource.newQuery()));
    this.onScrollBottom();
  };

  onScrollBottom = () => {
    this.setState({ scrollTop: 1000 });
  };

  renderTopSection(styles: QueriesTabStyls) {
    const { onOpenQueryInspector, options, onOptionsChange } = this.props;
    const { dataSourceItem, dataSource, dataSourceError, data } = this.state;

    if (!dataSource) {
      return null;
    }

    return (
      <div>
        <div className={styles.dataSourceRow}>
          <div className={styles.dataSourceRowItem}>
            <Field invalid={!!dataSourceError} error={dataSourceError}>
              <DataSourcePicker
                datasources={this.datasources}
                onChange={this.onChangeDataSource}
                current={dataSourceItem}
              />
            </Field>
          </div>
          <div className={styles.dataSourceRowItem}>
            <Button
              variant="secondary"
              icon="question-circle"
              title="Open data source help"
              onClick={this.onOpenHelp}
            />
          </div>
          <div className={styles.dataSourceRowItemOptions}>
            <QueryGroupOptionsEditor options={options} dataSource={dataSource} data={data} onChange={onOptionsChange} />
          </div>
          {onOpenQueryInspector && (
            <div className={styles.dataSourceRowItem}>
              <Button
                variant="secondary"
                onClick={onOpenQueryInspector}
                aria-label={selectors.components.QueryTab.queryInspectorButton}
              >
                Query inspector
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  onOpenHelp = () => {
    this.setState({ isHelpOpen: true });
  };

  onCloseHelp = () => {
    this.setState({ isHelpOpen: false });
  };

  renderMixedPicker = () => {
    // We cannot filter on mixed flag as some mixed data sources like external plugin
    // meta queries data source is mixed but also supports it's own queries
    const filteredDsList = this.datasources.filter(ds => ds.meta.id !== 'mixed');

    return (
      <DataSourcePicker
        datasources={filteredDsList}
        onChange={this.onAddMixedQuery}
        current={null}
        autoFocus={true}
        onBlur={this.onMixedPickerBlur}
        openMenuOnFocus={true}
      />
    );
  };

  onAddMixedQuery = (datasource: any) => {
    this.onAddQuery({ datasource: datasource.name });
    this.setState({ isAddingMixed: false, scrollTop: this.state.scrollTop + 10000 });
  };

  onMixedPickerBlur = () => {
    this.setState({ isAddingMixed: false });
  };

  onAddQuery = (query: Partial<DataQuery>) => {
    const { queries, onQueriesChange } = this.props;
    onQueriesChange(addQuery(queries, query));
    this.onScrollBottom();
  };

  setScrollTop = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    this.setState({ scrollTop: target.scrollTop });
  };

  renderQueries() {
    const { onQueriesChange, queries, onRunQueries } = this.props;
    const { dataSourceItem, data } = this.state;

    if (isSharedDashboardQuery(dataSourceItem.name)) {
      return <DashboardQueryEditor queries={queries} panelData={data} onChange={onQueriesChange} />;
    }

    return (
      <div aria-label={selectors.components.QueryTab.content}>
        <QueryEditorRows
          queries={queries}
          datasource={dataSourceItem}
          onQueriesChange={onQueriesChange}
          onAddQuery={this.onAddQuery}
          onRunQueries={onRunQueries}
          data={data}
        />
      </div>
    );
  }

  renderAddQueryRow() {
    const { dataSourceItem, isAddingMixed } = this.state;
    const showAddButton = !(isAddingMixed || isSharedDashboardQuery(dataSourceItem.name));

    return (
      <HorizontalGroup spacing="md" align="flex-start">
        {showAddButton && (
          <Button
            icon="plus"
            onClick={this.onAddQueryClick}
            variant="secondary"
            aria-label={selectors.components.QueryTab.addQuery}
          >
            Query
          </Button>
        )}
        {isAddingMixed && this.renderMixedPicker()}
        {config.featureToggles.expressions && (
          <Button icon="plus" onClick={this.onAddExpressionClick} variant="secondary">
            Expression
          </Button>
        )}
      </HorizontalGroup>
    );
  }

  render() {
    const { scrollTop, isHelpOpen } = this.state;
    const styles = getStyles();

    return (
      <CustomScrollbar
        autoHeightMin="100%"
        autoHide={true}
        updateAfterMountMs={300}
        scrollTop={scrollTop}
        setScrollTop={this.setScrollTop}
      >
        <div className={styles.innerWrapper}>
          {this.renderTopSection(styles)}
          <div className={styles.queriesWrapper}>{this.renderQueries()}</div>
          {this.renderAddQueryRow()}

          {isHelpOpen && (
            <Modal title="Data source help" isOpen={true} onDismiss={this.onCloseHelp}>
              <PluginHelp plugin={this.state.dataSourceItem.meta} type="query_help" />
            </Modal>
          )}
        </div>
      </CustomScrollbar>
    );
  }
}

const getStyles = stylesFactory(() => {
  const { theme } = config;

  return {
    innerWrapper: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: ${theme.spacing.md};
    `,
    dataSourceRow: css`
      display: flex;
      margin-bottom: ${theme.spacing.md};
    `,
    dataSourceRowItem: css`
      margin-right: ${theme.spacing.inlineFormMargin};
    `,
    dataSourceRowItemOptions: css`
      flex-grow: 1;
      margin-right: ${theme.spacing.inlineFormMargin};
    `,
    queriesWrapper: css`
      padding-bottom: 16px;
    `,
  };
});

type QueriesTabStyls = ReturnType<typeof getStyles>;
