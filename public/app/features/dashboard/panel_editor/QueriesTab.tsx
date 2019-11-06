// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';
import { css } from 'emotion';
// Components
import { EditorTabBody, EditorToolbarView } from './EditorTabBody';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { QueryInspector } from './QueryInspector';
import { QueryOptions } from './QueryOptions';
import { PanelOptionsGroup, TransformationsEditor, AlphaNotice } from '@grafana/ui';
import { QueryEditorRows } from './QueryEditorRows';
// Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getBackendSrv } from 'app/core/services/backend_srv';
import config from 'app/core/config';
// Types
import { PanelModel } from '../state/PanelModel';
import { DashboardModel } from '../state/DashboardModel';
import {
  LoadingState,
  DataTransformerConfig,
  DefaultTimeRange,
  DataSourceSelectItem,
  DataQuery,
  PanelData,
  PluginState,
} from '@grafana/data';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import { addQuery } from 'app/core/utils/query';
import { Unsubscribable } from 'rxjs';
import { isSharedDashboardQuery, DashboardQueryEditor } from 'app/plugins/datasource/dashboard';
import { expressionDatasource, ExpressionDatasourceID } from 'app/features/expressions/ExpressionDatasource';

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
}

export class QueriesTab extends PureComponent<Props, State> {
  datasources: DataSourceSelectItem[] = getDatasourceSrv().getMetricSources();
  backendSrv = getBackendSrv();
  querySubscription: Unsubscribable;

  state: State = {
    isLoadingHelp: false,
    currentDS: this.findCurrentDataSource(),
    helpContent: null,
    isPickerOpen: false,
    isAddingMixed: false,
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

  renderQueryInspector = () => {
    const { panel } = this.props;
    return <QueryInspector panel={panel} />;
  };

  renderHelp = () => {
    return <PluginHelp plugin={this.state.currentDS.meta} type="query_help" />;
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
    this.setState({ scrollTop: this.state.scrollTop + 10000 });
  };

  renderToolbar = () => {
    const { currentDS, isAddingMixed } = this.state;
    const showAddButton = !(isAddingMixed || isSharedDashboardQuery(currentDS.name));

    return (
      <>
        <DataSourcePicker datasources={this.datasources} onChange={this.onChangeDataSource} current={currentDS} />
        <div className="flex-grow-1" />
        {showAddButton && (
          <button className="btn navbar-button" onClick={this.onAddQueryClick}>
            Add Query
          </button>
        )}
        {isAddingMixed && this.renderMixedPicker()}
        {config.featureToggles.expressions && (
          <button className="btn navbar-button" onClick={this.onAddExpressionClick}>
            Add Expression
          </button>
        )}
      </>
    );
  };

  renderMixedPicker = () => {
    return (
      <DataSourcePicker
        datasources={this.datasources.filter(ds => !ds.meta.mixed)}
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

  onTransformersChange = (transformers: DataTransformerConfig[]) => {
    this.props.panel.setTransformations(transformers);
    this.forceUpdate();
  };

  setScrollTop = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    this.setState({ scrollTop: target.scrollTop });
  };

  renderQueryBody = () => {
    const { panel, dashboard } = this.props;
    const { currentDS, data } = this.state;

    if (isSharedDashboardQuery(currentDS.name)) {
      return <DashboardQueryEditor panel={panel} panelData={data} onChange={query => this.onUpdateQueries([query])} />;
    }

    return (
      <>
        <QueryEditorRows
          queries={panel.targets}
          datasource={currentDS}
          onChangeQueries={this.onUpdateQueries}
          onScrollBottom={this.onScrollBottom}
          panel={panel}
          dashboard={dashboard}
          data={data}
        />
        <PanelOptionsGroup>
          <QueryOptions panel={panel} datasource={currentDS} />
        </PanelOptionsGroup>
      </>
    );
  };

  render() {
    const { scrollTop, data } = this.state;
    const queryInspector: EditorToolbarView = {
      title: 'Query Inspector',
      render: this.renderQueryInspector,
    };

    const dsHelp: EditorToolbarView = {
      heading: 'Help',
      icon: 'fa fa-question',
      render: this.renderHelp,
    };

    const enableTransformations = config.featureToggles.transformations;

    return (
      <EditorTabBody
        heading="Query"
        renderToolbar={this.renderToolbar}
        toolbarItems={[queryInspector, dsHelp]}
        setScrollTop={this.setScrollTop}
        scrollTop={scrollTop}
      >
        <>
          {this.renderQueryBody()}

          {enableTransformations && (
            <PanelOptionsGroup
              title={
                <>
                  Query results
                  <AlphaNotice
                    state={PluginState.alpha}
                    className={css`
                      margin-left: 16px;
                    `}
                  />
                </>
              }
            >
              {this.state.data.state !== LoadingState.NotStarted && (
                <TransformationsEditor
                  transformations={this.props.panel.transformations || []}
                  onChange={this.onTransformersChange}
                  dataFrames={data.series}
                />
              )}
            </PanelOptionsGroup>
          )}
        </>
      </EditorTabBody>
    );
  }
}
