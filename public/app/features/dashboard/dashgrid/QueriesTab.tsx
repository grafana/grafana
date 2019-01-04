// Libraries
import React, { PureComponent, SFC } from 'react';
import _ from 'lodash';

// Components
import 'app/features/panel/metrics_tab';
import { EditorTabBody, EditorToolbarView} from './EditorTabBody';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';
import { QueryInspector } from './QueryInspector';
import { QueryOptions } from './QueryOptions';
import { AngularQueryComponentScope } from 'app/features/panel/metrics_tab';
import { PanelOptionSection } from './PanelOptionSection';

// Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { BackendSrv, getBackendSrv } from 'app/core/services/backend_srv';
import { AngularComponent, getAngularLoader } from 'app/core/services/AngularLoader';
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

interface LoadingPlaceholderProps {
  text: string;
}

const LoadingPlaceholder: SFC<LoadingPlaceholderProps> = ({ text }) => <h2>{text}</h2>;

export class QueriesTab extends PureComponent<Props, State> {
  element: HTMLElement;
  component: AngularComponent;
  datasources: DataSourceSelectItem[] = getDatasourceSrv().getMetricSources();
  backendSrv: BackendSrv = getBackendSrv();

  constructor(props) {
    super(props);
    const { panel } = props;

    this.state = {
      currentDS: this.datasources.find(datasource => datasource.value === panel.datasource),
      isLoadingHelp: false,
      helpContent: null,
      isPickerOpen: false,
      isAddingMixed: false,
    };
  }

  getAngularQueryComponentScope(): AngularQueryComponentScope {
    const { panel, dashboard } = this.props;

    return {
      panel: panel,
      dashboard: dashboard,
      refresh: () => panel.refresh(),
      render: () => panel.render,
      addQuery: this.onAddQuery,
      moveQuery: this.onMoveQuery,
      removeQuery: this.onRemoveQuery,
      events: panel.events,
    };
  }

  componentDidMount() {
    if (!this.element) {
      return;
    }

    const loader = getAngularLoader();
    const template = '<metrics-tab />';
    const scopeProps = {
      ctrl: this.getAngularQueryComponentScope(),
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
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
    return <QueryInspector panel={panel} LoadingPlaceholder={LoadingPlaceholder} />;
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
    this.component.digest();
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
    this.component.digest();
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
          <PanelOptionSection>
            <div className="query-editor-rows">
              <div ref={element => (this.element = element)} />

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
          </PanelOptionSection>
          <PanelOptionSection>
            <QueryOptions panel={panel} datasource={currentDS} />
          </PanelOptionSection>
        </>
      </EditorTabBody>
    );
  }
}
