// Libraries
import React, { PureComponent } from 'react';
// Components
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { QueryOptions } from './QueryOptions';
import { Button, CustomScrollbar, HorizontalGroup, Modal, stylesFactory } from '@grafana/ui';
import { getLocationSrv } from '@grafana/runtime';
import { QueryEditorRows } from './QueryEditorRows';
// Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import config from 'app/core/config';
// Types
import { PanelModel } from '../state/PanelModel';
import { DashboardModel } from '../state/DashboardModel';
import { DataQuery, DataSourceSelectItem, DefaultTimeRange, LoadingState, PanelData } from '@grafana/data';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import { addQuery } from 'app/core/utils/query';
import { Unsubscribable } from 'rxjs';
import { DashboardQueryEditor, isSharedDashboardQuery } from 'app/plugins/datasource/dashboard';
import { expressionDatasource, ExpressionDatasourceID } from 'app/features/expressions/ExpressionDatasource';
import { css } from 'emotion';
import { selectors } from '@grafana/e2e-selectors';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

interface State {
  currentDS: DataSourceSelectItem;
  helpContent: JSX.Element;
  isLoadingHelp: boolean;
  isPickerOpen: boolean;
  isAddingMixed: boolean;
  scrollTop: number;
  data: PanelData;
  isHelpOpen: boolean;
}

export class QueriesTab extends PureComponent<Props, State> {
  datasources: DataSourceSelectItem[] = getDatasourceSrv().getMetricSources();
  backendSrv = backendSrv;
  querySubscription: Unsubscribable;

  state: State = {
    isLoadingHelp: false,
    currentDS: this.findCurrentDataSource(),
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

  componentDidMount() {
    const { panel } = this.props;
    const queryRunner = panel.getQueryRunner();

    this.querySubscription = queryRunner.getData(false).subscribe({
      next: (data: PanelData) => this.onPanelDataUpdate(data),
    });
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

  findCurrentDataSource(): DataSourceSelectItem {
    const { panel } = this.props;
    return this.datasources.find(datasource => datasource.value === panel.datasource) || this.datasources[0];
  }

  onChangeDataSource = (datasource: DataSourceSelectItem) => {
    const { panel } = this.props;
    const { currentDS } = this.state;

    // switching to mixed
    if (datasource.meta.mixed) {
      // Set the datasource on all targets
      panel.targets.forEach(target => {
        if (target.datasource !== ExpressionDatasourceID) {
          target.datasource = panel.datasource;
          if (!target.datasource) {
            target.datasource = config.defaultDatasource;
          }
        }
      });
    } else if (currentDS) {
      // if switching from mixed
      if (currentDS.meta.mixed) {
        // Remove the explicit datasource
        for (const target of panel.targets) {
          if (target.datasource !== ExpressionDatasourceID) {
            delete target.datasource;
          }
        }
      } else if (currentDS.meta.id !== datasource.meta.id) {
        // we are changing data source type, clear queries
        panel.targets = [{ refId: 'A' }];
      }
    }

    panel.datasource = datasource.value;
    panel.refresh();

    this.setState({
      currentDS: datasource,
    });
  };

  openQueryInspector = () => {
    const { panel } = this.props;

    getLocationSrv().update({
      query: { inspect: panel.id, inspectTab: 'query' },
      partial: true,
    });
  };

  renderHelp = () => {
    return;
  };

  /**
   * Sets the queries for the panel
   */
  onUpdateQueries = (queries: DataQuery[]) => {
    this.props.panel.targets = queries;
    this.forceUpdate();
  };

  onAddQueryClick = () => {
    if (this.state.currentDS.meta.mixed) {
      this.setState({ isAddingMixed: true });
      return;
    }

    this.onUpdateQueries(addQuery(this.props.panel.targets));
    this.onScrollBottom();
  };

  onAddExpressionClick = () => {
    this.onUpdateQueries(addQuery(this.props.panel.targets, expressionDatasource.newQuery()));
    this.onScrollBottom();
  };

  onScrollBottom = () => {
    this.setState({ scrollTop: 1000 });
  };

  renderTopSection(styles: QueriesTabStyls) {
    const { panel } = this.props;
    const { currentDS, data } = this.state;

    return (
      <div>
        <div className={styles.dataSourceRow}>
          <div className={styles.dataSourceRowItem}>
            <DataSourcePicker datasources={this.datasources} onChange={this.onChangeDataSource} current={currentDS} />
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
            <QueryOptions panel={panel} datasource={currentDS} data={data} />
          </div>
          <div className={styles.dataSourceRowItem}>
            <Button
              variant="secondary"
              onClick={this.openQueryInspector}
              aria-label={selectors.components.QueryTab.queryInspectorButton}
            >
              Query inspector
            </Button>
          </div>
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
    this.props.panel.targets = addQuery(this.props.panel.targets, { datasource: datasource.name });
    this.setState({ isAddingMixed: false, scrollTop: this.state.scrollTop + 10000 });
    this.forceUpdate();
  };

  onMixedPickerBlur = () => {
    this.setState({ isAddingMixed: false });
  };

  onQueryChange = (query: DataQuery, index: number) => {
    this.props.panel.changeQuery(query, index);
    this.forceUpdate();
  };

  setScrollTop = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    this.setState({ scrollTop: target.scrollTop });
  };

  renderQueries() {
    const { panel, dashboard } = this.props;
    const { currentDS, data } = this.state;

    if (isSharedDashboardQuery(currentDS.name)) {
      return <DashboardQueryEditor panel={panel} panelData={data} onChange={query => this.onUpdateQueries([query])} />;
    }

    return (
      <div aria-label={selectors.components.QueryTab.content}>
        <QueryEditorRows
          queries={panel.targets}
          datasource={currentDS}
          onChangeQueries={this.onUpdateQueries}
          onScrollBottom={this.onScrollBottom}
          panel={panel}
          dashboard={dashboard}
          data={data}
        />
      </div>
    );
  }

  renderAddQueryRow(styles: QueriesTabStyls) {
    const { currentDS, isAddingMixed } = this.state;
    const showAddButton = !(isAddingMixed || isSharedDashboardQuery(currentDS.name));

    return (
      <HorizontalGroup spacing="md" align="flex-start">
        {showAddButton && (
          <Button icon="plus" onClick={this.onAddQueryClick} variant="secondary">
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
          {this.renderAddQueryRow(styles)}

          {isHelpOpen && (
            <Modal title="Data source help" isOpen={true} onDismiss={this.onCloseHelp}>
              <PluginHelp plugin={this.state.currentDS.meta} type="query_help" />
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
