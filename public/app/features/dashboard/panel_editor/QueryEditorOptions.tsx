// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import _ from 'lodash';

// Utils & Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { AngularComponent, getAngularLoader } from 'app/core/services/AngularLoader';
import { Emitter } from 'app/core/utils/emitter';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

// Types
import { PanelModel } from '../state/PanelModel';
import { DataQuery, DataSourceApi, TimeRange, DataQueryError, SeriesData } from '@grafana/ui';
import { DashboardModel } from '../state/DashboardModel';

interface Props {
  panel: PanelModel;
  query: DataQuery;
  dashboard: DashboardModel;
  onAddQuery: (query?: DataQuery) => void;
  onRemoveQuery: (query: DataQuery) => void;
  onMoveQuery: (query: DataQuery, direction: number) => void;
  onChange: (query: DataQuery) => void;
  dataSourceValue: string | null;
  inMixedMode: boolean;
}

interface State {
  loadedDataSourceValue: string | null | undefined;
  datasource: DataSourceApi | null;
  isCollapsed: boolean;
  hasTextEditMode: boolean;
  queryError: DataQueryError | null;
  queryResponse: SeriesData[] | null;
}

export class QueryEditorOptions extends PureComponent<Props, State> {
  element: HTMLElement | null = null;
  angularScope: AngularQueryOptionsComponentScope | null;
  angularQueryEditor: AngularComponent | null = null;

  state: State = {
    datasource: null,
    isCollapsed: false,
    loadedDataSourceValue: undefined,
    hasTextEditMode: false,
    queryError: null,
    queryResponse: null,
  };

  componentDidMount() {
    this.loadDatasource();
    this.props.panel.events.on('refresh', this.onPanelRefresh);
    this.props.panel.events.on('data-error', this.onPanelDataError);
    this.props.panel.events.on('data-received', this.onPanelDataReceived);
    this.props.panel.events.on('series-data-received', this.onSeriesDataReceived);
  }

  componentWillUnmount() {
    this.props.panel.events.off('refresh', this.onPanelRefresh);
    this.props.panel.events.off('data-error', this.onPanelDataError);
    this.props.panel.events.off('data-received', this.onPanelDataReceived);
    this.props.panel.events.off('series-data-received', this.onSeriesDataReceived);

    if (this.angularQueryEditor) {
      this.angularQueryEditor.destroy();
    }
  }

  onPanelDataError = (error: DataQueryError) => {
    // Some query controllers listen to data error events and need a digest
    if (this.angularQueryEditor) {
      // for some reason this needs to be done in next tick
      setTimeout(this.angularQueryEditor.digest);
      return;
    }

    // if error relates to this query store it in state and pass it on to query editor
    if (error.refId === this.props.query.refId) {
      this.setState({ queryError: error });
    }
  };

  // Only used by angular plugins
  onPanelDataReceived = () => {
    // Some query controllers listen to data error events and need a digest
    if (this.angularQueryEditor) {
      // for some reason this needs to be done in next tick
      setTimeout(this.angularQueryEditor.digest);
    }
  };

  // Only used by the React Query Editors
  onSeriesDataReceived = (data: SeriesData[]) => {
    if (!this.angularQueryEditor) {
      // only pass series related to this query to query editor
      const filterByRefId = data.filter(series => series.refId === this.props.query.refId);
      this.setState({ queryResponse: filterByRefId, queryError: null });
    }
  };

  onPanelRefresh = () => {
    if (this.angularScope) {
      this.angularScope.range = getTimeSrv().timeRange();
    }
  };

  getAngularQueryComponentScope(): AngularQueryOptionsComponentScope {
    const { panel, query, dashboard } = this.props;
    const { datasource } = this.state;

    return {
      datasource: datasource,
      target: query,
      panel: panel,
      dashboard: dashboard,
      refresh: () => panel.refresh(),
      render: () => panel.render(),
      events: panel.events,
      range: getTimeSrv().timeRange(),
    };
  }

  async loadDatasource() {
    const { query, panel } = this.props;
    const dataSourceSrv = getDatasourceSrv();
    const datasource = await dataSourceSrv.get(query.datasource || panel.datasource);

    this.setState({
      datasource,
      loadedDataSourceValue: this.props.dataSourceValue,
      hasTextEditMode: false,
    });
  }

  componentDidUpdate() {
    const { loadedDataSourceValue } = this.state;

    // check if we need to load another datasource
    if (loadedDataSourceValue !== this.props.dataSourceValue) {
      if (this.angularQueryEditor) {
        this.angularQueryEditor.destroy();
        this.angularQueryEditor = null;
      }
      this.loadDatasource();
      return;
    }

    if (!this.element || this.angularQueryEditor) {
      return;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="query-options-ctrl" />';
    const scopeProps = { ctrl: this.getAngularQueryComponentScope() };

    this.angularQueryEditor = loader.load(this.element, scopeProps, template);
    this.angularScope = scopeProps.ctrl;

    // give angular time to compile
    setTimeout(() => {
      this.setState({ hasTextEditMode: !!this.angularScope.toggleEditorMode });
    }, 10);
  }

  onToggleCollapse = () => {
    this.setState({ isCollapsed: !this.state.isCollapsed });
  };

  onRunQuery = () => {
    this.props.panel.refresh();
  };

  renderPluginEditor() {
    //const { query, onChange } = this.props;
    //const { datasource, queryResponse, queryError } = this.state;
    const { datasource } = this.state;

    if (datasource.components.QueryOptionsCtrl) {
      return <div ref={element => (this.element = element)} />;
    }

    /*    if (datasource.pluginExports.QueryEditor) {
      const QueryEditor = datasource.pluginExports.QueryEditor;
      return (
        <QueryEditor
          query={query}
          datasource={datasource}
          onChange={onChange}
          onRunQuery={this.onRunQuery}
          queryResponse={queryResponse}
          queryError={queryError}
        />
      );
    }
*/
    return <div />;
  }

  onToggleEditMode = () => {
    if (this.angularScope && this.angularScope.toggleEditorMode) {
      this.angularScope.toggleEditorMode();
      this.angularQueryEditor.digest();
    }

    if (this.state.isCollapsed) {
      this.setState({ isCollapsed: false });
    }
  };

  onRemoveQuery = () => {
    this.props.onRemoveQuery(this.props.query);
  };

  onCopyQuery = () => {
    const copy = _.cloneDeep(this.props.query);
    this.props.onAddQuery(copy);
  };

  onDisableQuery = () => {
    this.props.query.hide = !this.props.query.hide;
    this.onRunQuery();
    this.forceUpdate();
  };

  renderCollapsedText(): string | null {
    if (this.angularScope && this.angularScope.getCollapsedText) {
      return this.angularScope.getCollapsedText();
    }

    return null;
  }

  render() {
    const { query } = this.props;
    const { datasource, isCollapsed } = this.state;
    const isDisabled = query.hide;

    const bodyClasses = classNames('query-editor-options__body gf-form-query', {
      'query-editor-options__body--collapsed': isCollapsed,
    });

    const rowClasses = classNames('query-editor-options', {
      'query-editor-options--disabled': isDisabled,
      'gf-form-disabled': isDisabled,
    });

    if (!datasource) {
      return null;
    }

    return (
      <div className={rowClasses}>
        <div className={bodyClasses}>{this.renderPluginEditor()}</div>
      </div>
    );
  }
}

export interface AngularQueryOptionsComponentScope {
  target: DataQuery;
  panel: PanelModel;
  dashboard: DashboardModel;
  events: Emitter;
  refresh: () => void;
  render: () => void;
  datasource: DataSourceApi;
  toggleEditorMode?: () => void;
  getCollapsedText?: () => string;
  range: TimeRange;
}
