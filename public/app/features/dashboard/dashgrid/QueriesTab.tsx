// Libraries
import React, { SFC, PureComponent } from 'react';
import Remarkable from 'remarkable';
import _ from 'lodash';

// Components
import DataSourceOption from './DataSourceOption';
import { EditorTabBody } from './EditorTabBody';
import { DataSourcePicker } from './DataSourcePicker';
import { QueryInspector } from './QueryInspector';
import { TimeRangeOptions } from './TimeRangeOptions';
import './../../panel/metrics_tab';
import { AngularQueryComponentScope } from 'app/features/panel/metrics_tab';

// Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getBackendSrv, BackendSrv } from 'app/core/services/backend_srv';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import config from 'app/core/config';

// Types
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { DataSourceSelectItem, DataQuery } from 'app/types';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

interface State {
  currentDS: DataSourceSelectItem;
  helpContent: JSX.Element;
  isLoadingHelp: string;
  isPickerOpen: boolean;
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

  // loadHelp = () => {
  //   const { currentDatasource } = this.state;
  //   const hasHelp = currentDatasource.meta.hasQueryHelp;
  //
  //   if (hasHelp) {
  //     this.setState({
  //       helpContent: <h2>Loading help...</h2>,
  //       isLoadingHelp: true
  //     });
  //
  //     this.backendSrv
  //       .get(`/api/plugins/${currentDatasource.meta.id}/markdown/query_help`)
  //       .then(res => {
  //         const md = new Remarkable();
  //         const helpHtml = md.render(res); // TODO: Clean out dangerous code? Previous: this.helpHtml = this.$sce.trustAsHtml(md.render(res));
  //         this.setState({
  //           helpContent: <div className="markdown-html" dangerouslySetInnerHTML={{ __html: helpHtml }} />,
  //           isLoadingHelp: false
  //         });
  //       })
  //       .catch(() => {
  //         this.setState({
  //           helpContent: 'Error occured when loading help',
  //           isLoadingHelp: false,
  //         });
  //       });
  //   }
  // };

  // renderOptions = close => {
  //   const { currentDatasource } = this.state;
  //   const { queryOptions } = currentDatasource.meta;
  //   const { panel } = this.props;
  //
  //   const onChangeFn = (panelKey: string) => {
  //     return (value: string | number) => {
  //       panel[panelKey] = value;
  //       panel.refresh();
  //     };
  //   };
  //
  //   const allOptions = {
  //     cacheTimeout: {
  //       label: 'Cache timeout',
  //       placeholder: '60',
  //       name: 'cacheTimeout',
  //       value: panel.cacheTimeout,
  //       tooltipInfo: (
  //         <>
  //           If your time series store has a query cache this option can override the default cache timeout. Specify a
  //           numeric value in seconds.
  //         </>
  //       ),
  //     },
  //     maxDataPoints: {
  //       label: 'Max data points',
  //       placeholder: 'auto',
  //       name: 'maxDataPoints',
  //       value: panel.maxDataPoints,
  //       tooltipInfo: (
  //         <>
  //           The maximum data points the query should return. For graphs this is automatically set to one data point per
  //           pixel.
  //         </>
  //       ),
  //     },
  //     minInterval: {
  //       label: 'Min time interval',
  //       placeholder: '0',
  //       name: 'minInterval',
  //       value: panel.interval,
  //       panelKey: 'interval',
  //       tooltipInfo: (
  //         <>
  //           A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example{' '}
  //           <code>1m</code> if your data is written every minute. Access auto interval via variable{' '}
  //           <code>$__interval</code> for time range string and <code>$__interval_ms</code> for numeric variable that can
  //           be used in math expressions.
  //         </>
  //       ),
  //     },
  //   };
  //
  //   const dsOptions = queryOptions
  //     ? Object.keys(queryOptions).map(key => {
  //         const options = allOptions[key];
  //         return <DataSourceOption key={key} {...options} onChange={onChangeFn(allOptions[key].panelKey || key)} />;
  //       })
  //     : null;
  //
  //   return (
  //     <>
  //       <TimeRangeOptions panel={this.props.panel} />
  //       {dsOptions}
  //     </>
  //   );
  // };

  renderQueryInspector = () => {
    const { panel } = this.props;
    return <QueryInspector panel={panel} LoadingPlaceholder={LoadingPlaceholder} />;
  };

  // renderHelp = () => {
  //   const { helpHtml, isLoading } = this.state.help;
  //   return isLoading ? <LoadingPlaceholder text="Loading help..." /> : helpHtml;
  // };

  onAddQuery = (query?: DataQuery) => {
    this.props.panel.addQuery(query);
    this.forceUpdate();
  };

  onAddQueryClick = () => {
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

    return (
      <DataSourcePicker
        datasources={this.datasources}
        onChangeDataSource={this.onChangeDataSource}
        current={currentDS}
      />
    );
  };

  render() {
    const { panel } = this.props;

    // const dsInformation = {
    //   title: currentDatasource.name,
    //   imgSrc: currentDatasource.meta.info.logos.small,
    //   render: closeOpenView => (
    //     <DataSourcePicker
    //       datasources={this.datasources}
    //       onChangeDataSource={ds => {
    //         closeOpenView();
    //         this.onChangeDataSource(ds);
    //       }}
    //     />
    //   ),
    // };
    //
    // const queryInspector = {
    //   title: 'Query Inspector',
    //   render: this.renderQueryInspector,
    // };
    //
    // const dsHelp = {
    //   title: '',
    //   icon: 'fa fa-question',
    //   disabled: !hasQueryHelp,
    //   onClick: this.loadHelp,
    //   render: this.renderHelp,
    // };
    //
    // const options = {
    //   title: 'Time Range',
    //   icon: '',
    //   disabled: false,
    //   render: this.renderOptions,
    // };

    return (
      <EditorTabBody heading="Queries" renderToolbar={this.renderToolbar}>
        <div className="query-editor-rows gf-form-group">
          <div ref={element => (this.element = element)} />

          <div className="gf-form-query">
            <div className="gf-form gf-form-query-letter-cell">
              <label className="gf-form-label">
                <span className="gf-form-query-letter-cell-carret muted">
                  <i className="fa fa-caret-down" />
                </span>
                <span className="gf-form-query-letter-cell-letter">{panel.getNextQueryLetter()}</span>
              </label>
              <button className="btn btn-secondary gf-form-btn" onClick={this.onAddQueryClick}>
                Add Query
              </button>
            </div>
          </div>
        </div>
      </EditorTabBody>
    );
  }
}
