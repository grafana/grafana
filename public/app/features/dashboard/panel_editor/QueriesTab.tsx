// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';

// Components
import { EditorTabBody, EditorToolbarView } from './EditorTabBody';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { QueryInspector } from './QueryInspector';
import { QueryOptions } from './QueryOptions';
import { PanelOptionsGroup } from '@grafana/ui';
import { QueryEditorRow } from './QueryEditorRow';

// Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getBackendSrv } from 'app/core/services/backend_srv';
import config from 'app/core/config';
import store from 'app/core/store';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';

// Types
import { PanelModel } from '../state/PanelModel';
import { DashboardModel } from '../state/DashboardModel';
import { DataQuery, DataSourceSelectItem, PanelData } from '@grafana/ui';
import { LoadingState } from '@grafana/data';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import { PanelQueryRunnerFormat } from '../state/PanelQueryRunner';
import { Unsubscribable } from 'rxjs';
import { isSharedDashboardQuery } from 'app/plugins/datasource/dashboard/SharedQueryRunner';
import { DashboardQueryEditor } from 'app/plugins/datasource/dashboard/DashboardQueryEditor';
import { StoreState } from 'app/types';

import { mergeExploreQueries } from '../utils/panel';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  fromExplore?: boolean;
  queryRowCount?: number;
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
    },
  };

  componentDidMount() {
    const { panel, fromExplore, queryRowCount } = this.props;
    const queryRunner = panel.getQueryRunner();

    this.querySubscription = queryRunner.subscribe(this.panelDataObserver, PanelQueryRunnerFormat.both);

    panel.targets = mergeExploreQueries(panel, fromExplore, queryRowCount);

    panel.refresh();
    this.forceUpdate();
  }

  componentWillUnmount() {
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
      this.querySubscription = null;
    }
  }

  // Updates the response with information from the stream
  panelDataObserver = {
    next: (data: PanelData) => {
      try {
        const { panel } = this.props;
        if (data.state === LoadingState.Error) {
          panel.events.emit('data-error', data.error);
        } else if (data.state === LoadingState.Done) {
          panel.events.emit('data-received', data.legacy);
        }
      } catch (err) {
        console.log('Panel.events handler error', err);
      }
      this.setState({ data });
    },
  };

  findCurrentDataSource(): DataSourceSelectItem {
    const { panel } = this.props;
    return this.datasources.find(datasource => datasource.value === panel.datasource) || this.datasources[0];
  }

  onChangeDataSource = (datasource: any) => {
    const { panel } = this.props;
    const { currentDS } = this.state;

    // switching to mixed
    if (datasource.meta.mixed) {
      panel.targets.forEach(target => {
        target.datasource = panel.datasource;
        if (!target.datasource) {
          target.datasource = config.defaultDatasource;
        }
      });
    } else if (currentDS) {
      // if switching from mixed
      if (currentDS.meta.mixed) {
        for (const target of panel.targets) {
          delete target.datasource;
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

  onAddQuery = (query?: Partial<DataQuery>) => {
    this.props.panel.addQuery(query);
    this.setState({ scrollTop: this.state.scrollTop + 100000 });
  };

  onAddQueryClick = () => {
    if (this.state.currentDS.meta.mixed) {
      this.setState({ isAddingMixed: true });
      return;
    }

    this.onAddQuery();
  };

  onRemoveQuery = (query: DataQuery) => {
    const { panel } = this.props;

    const index = _.indexOf(panel.targets, query);
    panel.targets.splice(index, 1);
    panel.refresh();

    this.forceUpdate();
  };

  onMoveQuery = (query: DataQuery, direction: number) => {
    const { panel } = this.props;

    const index = _.indexOf(panel.targets, query);
    // @ts-ignore
    _.move(panel.targets, index, index + direction);

    this.forceUpdate();
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
      </>
    );
  };

  renderMixedPicker = () => {
    return (
      <DataSourcePicker
        datasources={this.datasources}
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

  onQueryChange = (query: DataQuery, index: number) => {
    this.props.panel.changeQuery(query, index);
    this.forceUpdate();
  };

  setScrollTop = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    this.setState({ scrollTop: target.scrollTop });
  };

  render() {
    const { panel, dashboard } = this.props;
    const { currentDS, scrollTop, data } = this.state;

    const queryInspector: EditorToolbarView = {
      title: 'Query Inspector',
      render: this.renderQueryInspector,
    };

    const dsHelp: EditorToolbarView = {
      heading: 'Help',
      icon: 'fa fa-question',
      render: this.renderHelp,
    };

    return (
      <EditorTabBody
        heading="Query"
        renderToolbar={this.renderToolbar}
        toolbarItems={[queryInspector, dsHelp]}
        setScrollTop={this.setScrollTop}
        scrollTop={scrollTop}
      >
        {isSharedDashboardQuery(currentDS.name) ? (
          <DashboardQueryEditor panel={panel} panelData={data} onChange={query => this.onQueryChange(query, 0)} />
        ) : (
          <>
            <div className="query-editor-rows">
              {panel.targets.map((query, index) => (
                <QueryEditorRow
                  dataSourceValue={query.datasource || panel.datasource}
                  key={query.refId}
                  panel={panel}
                  dashboard={dashboard}
                  data={data}
                  query={query}
                  onChange={query => this.onQueryChange(query, index)}
                  onRemoveQuery={this.onRemoveQuery}
                  onAddQuery={this.onAddQuery}
                  onMoveQuery={this.onMoveQuery}
                  inMixedMode={currentDS.meta.mixed}
                />
              ))}
            </div>
            <PanelOptionsGroup>
              <QueryOptions panel={panel} datasource={currentDS} />
            </PanelOptionsGroup>
          </>
        )}
      </EditorTabBody>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  fromExplore: !!state.location.query.fromExplore,
  queryRowCount: state.location.query.queryRowCount,
});

export default connectWithStore(QueriesTab, mapStateToProps);
