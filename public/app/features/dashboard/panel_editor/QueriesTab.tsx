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
import { BackendSrv, getBackendSrv } from 'app/core/services/backend_srv';
import config from 'app/core/config';

// Types
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { DataQuery, DataSourceSelectItem } from 'app/types';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';

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
}

export class QueriesTab extends PureComponent<Props, State> {
  datasources: DataSourceSelectItem[] = getDatasourceSrv().getMetricSources();
  backendSrv: BackendSrv = getBackendSrv();

  state: State = {
    isLoadingHelp: false,
    currentDS: this.findCurrentDataSource(),
    helpContent: null,
    isPickerOpen: false,
    isAddingMixed: false,
  };

  findCurrentDataSource(): DataSourceSelectItem {
    const { panel } = this.props;
    return this.datasources.find(datasource => datasource.value === panel.datasource) || this.datasources[0];
  }

  onChangeDataSource = datasource => {
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
    this.forceUpdate();
  };

  onAddQueryClick = () => {
    if (this.state.currentDS.meta.mixed) {
      this.setState({ isAddingMixed: true });
      return;
    }

    this.props.panel.addQuery();
    this.forceUpdate();
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
    _.move(panel.targets, index, index + direction);

    this.forceUpdate();
  };

  renderToolbar = () => {
    const { currentDS } = this.state;

    return <DataSourcePicker datasources={this.datasources} onChange={this.onChangeDataSource} current={currentDS} />;
  };

  renderMixedPicker = () => {
    return (
      <DataSourcePicker
        datasources={this.datasources}
        onChange={this.onAddMixedQuery}
        current={null}
        autoFocus={true}
        onBlur={this.onMixedPickerBlur}
      />
    );
  };

  onAddMixedQuery = datasource => {
    this.onAddQuery({ datasource: datasource.name });
    this.setState({ isAddingMixed: false });
  };

  onMixedPickerBlur = () => {
    this.setState({ isAddingMixed: false });
  };

  render() {
    const { panel } = this.props;
    const { currentDS, isAddingMixed } = this.state;

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
      <EditorTabBody heading="Queries" renderToolbar={this.renderToolbar} toolbarItems={[queryInspector, dsHelp]}>
        <>
          <PanelOptionsGroup>
            <div className="query-editor-rows">
              {panel.targets.map((query, index) => (
                <QueryEditorRow
                  datasourceName={query.datasource || panel.datasource}
                  key={query.refId}
                  panel={panel}
                  query={query}
                  onRemoveQuery={this.onRemoveQuery}
                  onAddQuery={this.onAddQuery}
                  onMoveQuery={this.onMoveQuery}
                />
              ))}

              <div className="gf-form-query">
                <div className="gf-form gf-form-query-letter-cell">
                  <label className="gf-form-label">
                    <span className="gf-form-query-letter-cell-carret muted">
                      <i className="fa fa-caret-down" />
                    </span>{' '}
                    <span className="gf-form-query-letter-cell-letter">{panel.getNextQueryLetter()}</span>
                  </label>
                </div>
                <div className="gf-form">
                  {!isAddingMixed && (
                    <button className="btn btn-secondary gf-form-btn" onClick={this.onAddQueryClick}>
                      Add Query
                    </button>
                  )}
                  {isAddingMixed && this.renderMixedPicker()}
                </div>
              </div>
            </div>
          </PanelOptionsGroup>
          <PanelOptionsGroup>
            <QueryOptions panel={panel} datasource={currentDS} />
          </PanelOptionsGroup>
        </>
      </EditorTabBody>
    );
  }
}
