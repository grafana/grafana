import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

import PageHeader from 'app/core/components/PageHeader/PageHeader';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import PluginSettings from './PluginSettings';
import BasicSettings from './BasicSettings';
import ButtonRow from './ButtonRow';

import appEvents from 'app/core/app_events';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { getDataSource, getDataSourceMeta } from '../state/selectors';
import { deleteDataSource, loadDataSource, setDataSourceName, setIsDefault, updateDataSource } from '../state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';

import { DataSource, NavModel, Plugin } from 'app/types/';
import { getDataSourceLoadingNav } from '../state/navModel';

export interface Props {
  navModel: NavModel;
  dataSource: DataSource;
  dataSourceMeta: Plugin;
  pageId: number;
  deleteDataSource: typeof deleteDataSource;
  loadDataSource: typeof loadDataSource;
  setDataSourceName: typeof setDataSourceName;
  updateDataSource: typeof updateDataSource;
  setIsDefault: typeof setIsDefault;
}

interface State {
  dataSource: DataSource;
  isTesting?: boolean;
  testingMessage?: string;
  testingStatus?: string;
}

enum DataSourceStates {
  Alpha = 'alpha',
  Beta = 'beta',
}

export class DataSourceSettings extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      dataSource: {} as DataSource,
    };
  }

  async componentDidMount() {
    const { loadDataSource, pageId } = this.props;

    await loadDataSource(pageId);
  }

  onSubmit = async event => {
    event.preventDefault();

    await this.props.updateDataSource({ ...this.state.dataSource, name: this.props.dataSource.name });

    this.testDataSource();
  };

  onDelete = () => {
    appEvents.emit('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete this data source?',
      yesText: 'Delete',
      icon: 'fa-trash',
      onConfirm: () => {
        this.confirmDelete();
      },
    });
  };

  confirmDelete = () => {
    this.props.deleteDataSource();
  };

  onModelChange = dataSource => {
    this.setState({
      dataSource: dataSource,
    });
  };

  isReadOnly() {
    return this.props.dataSource.readOnly === true;
  }

  shouldRenderInfoBox() {
    const { state } = this.props.dataSourceMeta;

    return state === DataSourceStates.Alpha || state === DataSourceStates.Beta;
  }

  getInfoText() {
    const { dataSourceMeta } = this.props;

    switch (dataSourceMeta.state) {
      case DataSourceStates.Alpha:
        return (
          'This plugin is marked as being in alpha state, which means it is in early development phase and updates' +
          ' will include breaking changes.'
        );

      case DataSourceStates.Beta:
        return (
          'This plugin is marked as being in a beta development state. This means it is in currently in active' +
          ' development and could be missing important features.'
        );
    }

    return null;
  }

  renderIsReadOnlyMessage() {
    return (
      <div className="grafana-info-box span8">
        This datasource was added by config and cannot be modified using the UI. Please contact your server admin to
        update this datasource.
      </div>
    );
  }

  async testDataSource() {
    const dsApi = await getDatasourceSrv().get(this.state.dataSource.name);

    if (!dsApi.testDatasource) {
      return;
    }

    this.setState({ isTesting: true, testingMessage: 'Testing...', testingStatus: 'info' });

    getBackendSrv().withNoBackendCache(async () => {
      try {
        const result = await dsApi.testDatasource();

        this.setState({
          isTesting: false,
          testingStatus: result.status,
          testingMessage: result.message,
        });
      } catch (err) {
        let message = '';

        if (err.statusText) {
          message = 'HTTP Error ' + err.statusText;
        } else {
          message = err.message;
        }

        this.setState({
          isTesting: false,
          testingStatus: 'error',
          testingMessage: message,
        });
      }
    });
  }

  render() {
    const { dataSource, dataSourceMeta, navModel, setDataSourceName, setIsDefault } = this.props;
    const { testingMessage, testingStatus } = this.state;

    return (
      <div>
        <PageHeader model={navModel} />
        {Object.keys(dataSource).length === 0 ? (
          <PageLoader pageName="Data source settings" />
        ) : (
          <div className="page-container page-body">
            <div>
              <form onSubmit={this.onSubmit}>
                {this.isReadOnly() && this.renderIsReadOnlyMessage()}
                {this.shouldRenderInfoBox() && <div className="grafana-info-box">{this.getInfoText()}</div>}

                <BasicSettings
                  dataSourceName={dataSource.name}
                  isDefault={dataSource.isDefault}
                  onDefaultChange={state => setIsDefault(state)}
                  onNameChange={name => setDataSourceName(name)}
                />

                {dataSourceMeta.module && (
                  <PluginSettings
                    dataSource={dataSource}
                    dataSourceMeta={dataSourceMeta}
                    onModelChange={this.onModelChange}
                  />
                )}

                <div className="gf-form-group section">
                  {testingMessage && (
                    <div className={`alert-${testingStatus} alert`}>
                      <div className="alert-icon">
                        {testingStatus === 'error' ? (
                          <i className="fa fa-exclamation-triangle" />
                        ) : (
                          <i className="fa fa-check" />
                        )}
                      </div>
                      <div className="alert-body">
                        <div className="alert-title">{testingMessage}</div>
                      </div>
                    </div>
                  )}
                </div>

                <ButtonRow
                  onSubmit={event => this.onSubmit(event)}
                  isReadOnly={this.isReadOnly()}
                  onDelete={this.onDelete}
                />
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }
}

function mapStateToProps(state) {
  const pageId = getRouteParamsId(state.location);
  const dataSource = getDataSource(state.dataSources, pageId);

  return {
    navModel: getNavModel(state.navIndex, `datasource-settings-${pageId}`, getDataSourceLoadingNav('settings')),
    dataSource: getDataSource(state.dataSources, pageId),
    dataSourceMeta: getDataSourceMeta(state.dataSources, dataSource.type),
    pageId: pageId,
  };
}

const mapDispatchToProps = {
  deleteDataSource,
  loadDataSource,
  setDataSourceName,
  updateDataSource,
  setIsDefault,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DataSourceSettings));
