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
import { DataQuery, DataSourceApi, TimeRange } from '@grafana/ui';

interface Props {
  panel: PanelModel;
  query: DataQuery;
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
  angularScope: AngularQueryComponentScope | null;
}

export class QueryEditorRow extends PureComponent<Props, State> {
  element: HTMLElement | null = null;
  angularQueryEditor: AngularComponent | null = null;

  state: State = {
    datasource: null,
    isCollapsed: false,
    angularScope: null,
    loadedDataSourceValue: undefined,
  };

  componentDidMount() {
    this.loadDatasource();
    this.props.panel.events.on('refresh', this.onPanelRefresh);
  }

  onPanelRefresh = () => {
    if (this.state.angularScope) {
      this.state.angularScope.range = getTimeSrv().timeRange();
    }
  };

  getAngularQueryComponentScope(): AngularQueryComponentScope {
    const { panel, query } = this.props;
    const { datasource } = this.state;

    return {
      datasource: datasource,
      target: query,
      panel: panel,
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

    this.setState({ datasource, loadedDataSourceValue: this.props.dataSourceValue });
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
    const template = '<plugin-component type="query-ctrl" />';
    const scopeProps = { ctrl: this.getAngularQueryComponentScope() };

    this.angularQueryEditor = loader.load(this.element, scopeProps, template);

    // give angular time to compile
    setTimeout(() => {
      this.setState({ angularScope: scopeProps.ctrl });
    }, 10);
  }

  componentWillUnmount() {
    this.props.panel.events.off('refresh', this.onPanelRefresh);

    if (this.angularQueryEditor) {
      this.angularQueryEditor.destroy();
    }
  }

  onToggleCollapse = () => {
    this.setState({ isCollapsed: !this.state.isCollapsed });
  };

  onRunQuery = () => {
    this.props.panel.refresh();
  };

  renderPluginEditor() {
    const { query, onChange } = this.props;
    const { datasource } = this.state;

    if (datasource.pluginExports.QueryCtrl) {
      return <div ref={element => (this.element = element)} />;
    }

    if (datasource.pluginExports.QueryEditor) {
      const QueryEditor = datasource.pluginExports.QueryEditor;
      return (
        <QueryEditor
          query={query}
          datasource={datasource}
          onChange={onChange}
          onRunQuery={this.onRunQuery}
        />
      );
    }

    return <div>Data source plugin does not export any Query Editor component</div>;
  }

  onToggleEditMode = () => {
    const { angularScope } = this.state;

    if (angularScope && angularScope.toggleEditorMode) {
      angularScope.toggleEditorMode();
      this.angularQueryEditor.digest();
    }

    if (this.state.isCollapsed) {
      this.setState({ isCollapsed: false });
    }
  };

  get hasTextEditMode() {
    const { angularScope } = this.state;
    return angularScope && angularScope.toggleEditorMode;
  }

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
    const { angularScope } = this.state;

    if (angularScope && angularScope.getCollapsedText) {
      return angularScope.getCollapsedText();
    }

    return null;
  }

  render() {
    const { query, inMixedMode } = this.props;
    const { datasource, isCollapsed } = this.state;
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
            {this.hasTextEditMode && (
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
        <div className={bodyClasses}>{this.renderPluginEditor()}</div>
      </div>
    );
  }
}

export interface AngularQueryComponentScope {
  target: DataQuery;
  panel: PanelModel;
  events: Emitter;
  refresh: () => void;
  render: () => void;
  datasource: DataSourceApi;
  toggleEditorMode?: () => void;
  getCollapsedText?: () => string;
  range: TimeRange;
}
