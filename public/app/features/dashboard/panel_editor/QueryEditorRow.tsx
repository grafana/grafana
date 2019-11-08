// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import _ from 'lodash';
// Utils & Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';
import { Emitter } from 'app/core/utils/emitter';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
// Types
import { PanelModel } from '../state/PanelModel';
import { ErrorBoundaryAlert } from '@grafana/ui';
import {
  DataQuery,
  DataSourceApi,
  PanelData,
  PanelEvents,
  TimeRange,
  LoadingState,
  toLegacyResponseData,
} from '@grafana/data';
import { DashboardModel } from '../state/DashboardModel';

interface Props {
  panel: PanelModel;
  data: PanelData;
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
  data?: PanelData;
}

export class QueryEditorRow extends PureComponent<Props, State> {
  element: HTMLElement | null = null;
  angularScope: AngularQueryComponentScope | null;
  angularQueryEditor: AngularComponent | null = null;

  state: State = {
    datasource: null,
    isCollapsed: false,
    loadedDataSourceValue: undefined,
    hasTextEditMode: false,
    data: null,
  };

  componentDidMount() {
    this.loadDatasource();
  }

  componentWillUnmount() {
    if (this.angularQueryEditor) {
      this.angularQueryEditor.destroy();
    }
  }

  getAngularQueryComponentScope(): AngularQueryComponentScope {
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
      hasTextEditMode: _.has(datasource, 'components.QueryCtrl.prototype.toggleEditorMode'),
    });
  }

  componentDidUpdate(prevProps: Props) {
    const { loadedDataSourceValue } = this.state;
    const { data, query, panel } = this.props;

    if (data !== prevProps.data) {
      this.setState({ data: filterPanelDataToQuery(data, query.refId) });

      if (this.angularScope) {
        this.angularScope.range = getTimeSrv().timeRange();
      }

      if (this.angularQueryEditor) {
        notifyAngularQueryEditorsOfData(panel, data, this.angularQueryEditor);
      }
    }

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
    const template = '<plugin-component type="query-ctrl" />';
    const scopeProps = { ctrl: this.getAngularQueryComponentScope() };
    this.angularQueryEditor = loader.load(this.element, scopeProps, template);
    this.angularScope = scopeProps.ctrl;
  }

  onToggleCollapse = () => {
    this.setState({ isCollapsed: !this.state.isCollapsed });
  };

  onRunQuery = () => {
    this.props.panel.refresh();
  };

  renderPluginEditor() {
    const { query, onChange } = this.props;
    const { datasource, data } = this.state;

    if (datasource.components.QueryCtrl) {
      return <div ref={element => (this.element = element)} />;
    }

    if (datasource.components.QueryEditor) {
      const QueryEditor = datasource.components.QueryEditor;

      return (
        <QueryEditor
          query={query}
          datasource={datasource}
          onChange={onChange}
          onRunQuery={this.onRunQuery}
          data={data}
        />
      );
    }

    return <div>Data source plugin does not export any Query Editor component</div>;
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
    const { datasource } = this.state;
    if (datasource.getQueryDisplayText) {
      return datasource.getQueryDisplayText(this.props.query);
    }

    if (this.angularScope && this.angularScope.getCollapsedText) {
      return this.angularScope.getCollapsedText();
    }
    return null;
  }

  render() {
    const { query, inMixedMode } = this.props;
    const { datasource, isCollapsed, hasTextEditMode } = this.state;
    const isDisabled = query.hide;

    const bodyClasses = classNames('query-editor-row__body gf-form-query', {
      'query-editor-row__body--collapsed': isCollapsed,
    });

    const rowClasses = classNames('query-editor-row', {
      'query-editor-row--disabled': isDisabled,
      'gf-form-disabled': isDisabled,
    });

    if (!datasource) {
      return null;
    }

    return (
      <div className={rowClasses}>
        <div className="query-editor-row__header">
          <div className="query-editor-row__ref-id" onClick={this.onToggleCollapse}>
            {isCollapsed && <i className="fa fa-caret-right" />}
            {!isCollapsed && <i className="fa fa-caret-down" />}
            <span>{query.refId}</span>
            {inMixedMode && <em className="query-editor-row__context-info"> ({datasource.name})</em>}
            {isDisabled && <em className="query-editor-row__context-info"> Disabled</em>}
          </div>
          <div className="query-editor-row__collapsed-text" onClick={this.onToggleEditMode}>
            {isCollapsed && <div>{this.renderCollapsedText()}</div>}
          </div>
          <div className="query-editor-row__actions">
            {hasTextEditMode && (
              <button
                className="query-editor-row__action"
                onClick={this.onToggleEditMode}
                title="Toggle text edit mode"
              >
                <i className="fa fa-fw fa-pencil" />
              </button>
            )}
            <button className="query-editor-row__action" onClick={() => this.props.onMoveQuery(query, 1)}>
              <i className="fa fa-fw fa-arrow-down" />
            </button>
            <button className="query-editor-row__action" onClick={() => this.props.onMoveQuery(query, -1)}>
              <i className="fa fa-fw fa-arrow-up" />
            </button>
            <button className="query-editor-row__action" onClick={this.onCopyQuery} title="Duplicate query">
              <i className="fa fa-fw fa-copy" />
            </button>
            <button className="query-editor-row__action" onClick={this.onDisableQuery} title="Disable/enable query">
              {isDisabled && <i className="fa fa-fw fa-eye-slash" />}
              {!isDisabled && <i className="fa fa-fw fa-eye" />}
            </button>
            <button className="query-editor-row__action" onClick={this.onRemoveQuery} title="Remove query">
              <i className="fa fa-fw fa-trash" />
            </button>
          </div>
        </div>
        <div className={bodyClasses}>
          <ErrorBoundaryAlert>{this.renderPluginEditor()}</ErrorBoundaryAlert>
        </div>
      </div>
    );
  }
}

// To avoid sending duplicate events for each row we have this global cached object here
// So we can check if we already emitted this legacy data event
let globalLastPanelDataCache: PanelData = null;

function notifyAngularQueryEditorsOfData(panel: PanelModel, data: PanelData, editor: AngularComponent) {
  if (data === globalLastPanelDataCache) {
    return;
  }

  globalLastPanelDataCache = data;

  if (data.state === LoadingState.Done) {
    const legacy = data.series.map(v => toLegacyResponseData(v));
    panel.events.emit(PanelEvents.dataReceived, legacy);
  } else if (data.state === LoadingState.Error) {
    panel.events.emit(PanelEvents.dataError, data.error);
  }

  // Some query controllers listen to data error events and need a digest
  // for some reason this needs to be done in next tick
  setTimeout(editor.digest);
}

export interface AngularQueryComponentScope {
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

/**
 * Get a version of the PanelData limited to the query we are looking at
 */
export function filterPanelDataToQuery(data: PanelData, refId: string): PanelData | undefined {
  const series = data.series.filter(series => series.refId === refId);

  // No matching series
  if (!series.length) {
    return undefined;
  }

  // Only say this is an error if the error links to the query
  let state = LoadingState.Done;
  const error = data.error && data.error.refId === refId ? data.error : undefined;
  if (error) {
    state = LoadingState.Error;
  }

  const timeRange = data.timeRange;

  return {
    ...data,
    state,
    series,
    error,
    timeRange,
  };
}
