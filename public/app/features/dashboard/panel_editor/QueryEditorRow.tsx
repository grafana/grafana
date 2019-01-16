// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';

// Utils & Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { AngularComponent, getAngularLoader } from 'app/core/services/AngularLoader';
import { Emitter } from 'app/core/utils/emitter';

// Types
import { PanelModel } from '../panel_model';
import { DataQuery, DataSourceApi } from 'app/types/series';

interface Props {
  panel: PanelModel;
  query: DataQuery;
  onAddQuery: (query?: DataQuery) => void;
  onRemoveQuery: (query: DataQuery) => void;
  onMoveQuery: (query: DataQuery, direction: number) => void;
  datasourceName: string | null;
}

interface State {
  datasource: DataSourceApi | null;
  isCollapsed: boolean;
}

export class QueryEditorRow extends PureComponent<Props, State> {
  element: HTMLElement | null = null;
  angularQueryEditor: AngularComponent | null = null;

  state: State = {
    datasource: null,
    isCollapsed: false,
  };

  componentDidMount() {
    this.loadDatasource();
  }

  getAngularQueryComponentScope(): AngularQueryComponentScope {
    const { panel, onAddQuery, onMoveQuery, onRemoveQuery, query } = this.props;
    const { datasource } = this.state;

    return {
      datasource: datasource,
      target: query,
      panel: panel,
      refresh: () => panel.refresh(),
      render: () => panel.render,
      addQuery: onAddQuery,
      moveQuery: onMoveQuery,
      removeQuery: onRemoveQuery,
      events: panel.events,
    };
  }

  async loadDatasource() {
    const { query, panel } = this.props;
    const dataSourceSrv = getDatasourceSrv();
    const datasource = await dataSourceSrv.get(query.datasource || panel.datasource);

    this.setState({ datasource });
  }

  componentDidUpdate() {
    const { datasource } = this.state;

    // check if we need to load another datasource
    if (datasource && datasource.name !== this.props.datasourceName) {
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
  }

  componentWillUnmount() {
    if (this.angularQueryEditor) {
      this.angularQueryEditor.destroy();
    }
  }

  onToggleCollapse = () => {
    this.setState({ isCollapsed: !this.state.isCollapsed });
  };

  render() {
    const { query } = this.props;
    const { datasource, isCollapsed } = this.state;
    const bodyClasses = classNames('query-editor-box__body gf-form-query', {hide: isCollapsed});

    if (!datasource) {
      return null;
    }

    if (datasource.pluginExports.QueryCtrl) {
      return (
        <div className="query-editor-box">
          <div className="query-editor-box__header">
            <div className="query-editor-box__ref-id" onClick={this.onToggleCollapse}>
              {isCollapsed && <i className="fa fa-caret-right" />}
              {!isCollapsed && <i className="fa fa-caret-down" />}
              <span>{query.refId}</span>
            </div>
            <div className="query-editor-box__actions">
              <button className="query-editor-box__action">
                <i className="fa fa-fw fa-arrow-down" />
              </button>
              <button className="query-editor-box__action">
                <i className="fa fa-fw fa-arrow-up" />
              </button>
              <button className="query-editor-box__action">
                <i className="fa fa-fw fa-copy" />
              </button>
              <button className="query-editor-box__action">
                <i className="fa fa-fw fa-eye" />
              </button>
              <button className="query-editor-box__action">
                <i className="fa fa-fw fa-trash" />
              </button>
            </div>
          </div>
          <div className={bodyClasses}>
            <div ref={element => (this.element = element)} />
          </div>
        </div>
      );
    } else if (datasource.pluginExports.QueryEditor) {
      const QueryEditor = datasource.pluginExports.QueryEditor;
      return <QueryEditor />;
    }

    return <div>Data source plugin does not export any Query Editor component</div>;
  }
}

export interface AngularQueryComponentScope {
  target: DataQuery;
  panel: PanelModel;
  events: Emitter;
  refresh: () => void;
  render: () => void;
  removeQuery: (query: DataQuery) => void;
  addQuery: (query?: DataQuery) => void;
  moveQuery: (query: DataQuery, direction: number) => void;
  datasource: DataSourceApi;
}
