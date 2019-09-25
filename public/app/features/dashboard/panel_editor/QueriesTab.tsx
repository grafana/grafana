// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';
import { css } from 'emotion';
// Components
import { EditorTabBody, EditorToolbarView } from './EditorTabBody';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { QueryInspector } from './QueryInspector';
import { QueryOptions } from './QueryOptions';
import {
  PanelOptionsGroup,
  TransformationsEditor,
  DataQuery,
  DataSourceSelectItem,
  PanelData,
  AlphaNotice,
  PluginState,
  Select,
} from '@grafana/ui';
import { QueryEditorRows } from './QueryEditorRows';

// Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getBackendSrv } from 'app/core/services/backend_srv';
import config from 'app/core/config';
// Types
import { PanelModel } from '../state/PanelModel';
import { DashboardModel } from '../state/DashboardModel';
import { LoadingState, DataTransformerConfig, DefaultTimeRange, SelectableValue } from '@grafana/data';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import { Unsubscribable } from 'rxjs';
import { isSharedDashboardQuery, DashboardQueryEditor } from 'app/plugins/datasource/dashboard';
import { isMultiResolutionQuery } from 'app/plugins/datasource/multi/MultiDataSource';
import { addQuery } from 'app/core/utils/query';
import { MultiQueryEditor } from 'app/plugins/datasource/multi/MultiQueryEditor';
import { getMultiResolutionQuery } from 'app/plugins/datasource/multi/MultiDataSource';
import { ResolutionSelection } from 'app/plugins/datasource/multi/types';

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

    // switching to mixed|multi
    if (datasource.meta.mixed) {
      // Add the datasource to everything
      panel.targets.forEach(target => {
        target.datasource = panel.datasource;
        if (!target.datasource) {
          target.datasource = config.defaultDatasource;
        }
      });

      // Move the queries under the first value
      if (isMultiResolutionQuery(datasource.name)) {
        const q = getMultiResolutionQuery([]);
        q.resolutions[0].targets = panel.targets;
        panel.targets = [q];
      }
    } else if (currentDS) {
      // if switching from mixed|multi
      if (currentDS.meta.mixed) {
        // Use targets from the first resolution
        if (isMultiResolutionQuery(currentDS.name)) {
          const q = getMultiResolutionQuery(panel.targets);
          panel.targets = q.resolutions[0].targets;
        }

        // Remove the datasource description
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

  renderToolbar = () => {
    const { currentDS, isAddingMixed } = this.state;

    const isMultiResolution = isMultiResolutionQuery(currentDS.name);
    const showAddButton = !(isAddingMixed || isSharedDashboardQuery(currentDS.name));

    return (
      <>
        <DataSourcePicker datasources={this.datasources} onChange={this.onChangeDataSource} current={currentDS} />
        {isMultiResolution && this.renderMultiPicker()}

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

  onSelectResolutionType = (item: SelectableValue<ResolutionSelection>) => {
    const query = getMultiResolutionQuery(this.props.panel.targets);
    query.select = item.value!;
    this.onUpdateQueries([query]);
  };

  renderMultiPicker = () => {
    const { panel } = this.props;
    const s0 = { value: ResolutionSelection.interval, label: 'Interval', description: 'Select queries by interval' };
    const s1 = { value: ResolutionSelection.range, label: 'Range', description: 'Select queries based on range' };

    const q = getMultiResolutionQuery(panel.targets);
    const isInterval = q.select === s0.value;

    let time = '';
    const last = panel.getQueryRunner().lastRequest;
    if (last) {
      if (isInterval) {
        time = last.interval;
      } else if (last.range) {
        const ms = last.range.to.valueOf() - last.range.from.valueOf();
        time = ms / 1000.0 + 's';
      }
    }

    return (
      <>
        <div className="gf-form-inline">
          <Select options={[s0, s1]} value={isInterval ? s0 : s1} onChange={this.onSelectResolutionType} />
        </div>
        <div className="gf-form-inline">
          &nbsp;&nbsp;
          {time}
        </div>
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
    const { targets } = this.props.panel;
    if (isMultiResolutionQuery(this.state.currentDS.name)) {
      const q = getMultiResolutionQuery(targets);
      console.log('TODO add query to', q);
      this.onUpdateQueries([q]);
    } else {
      this.onUpdateQueries(addQuery(targets, { datasource: datasource.name }));
    }
    this.setState({ isAddingMixed: false, scrollTop: this.state.scrollTop + 10000 });
  };

  onMixedPickerBlur = () => {
    this.setState({ isAddingMixed: false });
  };

  onTransformersChange = (transformers: DataTransformerConfig[]) => {
    this.props.panel.setTransformations(transformers);
    this.forceUpdate();
  };

  setScrollTop = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    this.setState({ scrollTop: target.scrollTop });
  };

  onScrollBottom = () => {
    this.setState({ scrollTop: this.state.scrollTop + 10000 });
  };

  renderQueryBody = () => {
    const { panel, dashboard } = this.props;
    const { currentDS, data } = this.state;

    if (isSharedDashboardQuery(currentDS.name)) {
      return <DashboardQueryEditor panel={panel} panelData={data} onChange={query => this.onUpdateQueries([query])} />;
    }

    return (
      <>
        {isMultiResolutionQuery(currentDS.name) ? (
          <MultiQueryEditor
            panel={panel}
            data={data}
            onChange={query => this.onUpdateQueries([query])}
            dashboard={dashboard}
            onScrollBottom={this.onScrollBottom}
          />
        ) : (
          <QueryEditorRows
            queries={panel.targets}
            datasource={currentDS}
            onChangeQueries={this.onUpdateQueries}
            onScrollBottom={this.onScrollBottom}
            panel={panel}
            dashboard={dashboard}
            data={data}
          />
        )}
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
