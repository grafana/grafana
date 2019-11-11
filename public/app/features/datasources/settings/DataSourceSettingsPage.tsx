// Libraries
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import isString from 'lodash/isString';
// Components
import Page from 'app/core/components/Page/Page';
import { GenericDataSourcePlugin, PluginSettings } from './PluginSettings';
import BasicSettings from './BasicSettings';
import ButtonRow from './ButtonRow';
// Services & Utils
import appEvents from 'app/core/app_events';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
// Actions & selectors
import { getDataSource, getDataSourceMeta } from '../state/selectors';
import {
  dataSourceLoaded,
  deleteDataSource,
  loadDataSource,
  setDataSourceName,
  setIsDefault,
  updateDataSource,
} from '../state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';
// Types
import { CoreEvents, StoreState } from 'app/types/';
import { UrlQueryMap } from '@grafana/runtime';
import { DataSourcePluginMeta, DataSourceSettings, NavModel } from '@grafana/data';
import { getDataSourceLoadingNav } from '../state/navModel';
import PluginStateinfo from 'app/features/plugins/PluginStateInfo';
import { importDataSourcePlugin } from 'app/features/plugins/plugin_loader';

export interface Props {
  navModel: NavModel;
  dataSource: DataSourceSettings;
  dataSourceMeta: DataSourcePluginMeta;
  pageId: number;
  deleteDataSource: typeof deleteDataSource;
  loadDataSource: typeof loadDataSource;
  setDataSourceName: typeof setDataSourceName;
  updateDataSource: typeof updateDataSource;
  setIsDefault: typeof setIsDefault;
  dataSourceLoaded: typeof dataSourceLoaded;
  plugin?: GenericDataSourcePlugin;
  query: UrlQueryMap;
  page?: string;
}

interface State {
  plugin?: GenericDataSourcePlugin;
  isTesting?: boolean;
  testingMessage?: string;
  testingStatus?: string;
  loadError?: any;
}

export class DataSourceSettingsPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      plugin: props.plugin,
    };
  }

  async loadPlugin(pluginId?: string) {
    const { dataSourceMeta } = this.props;
    let importedPlugin: GenericDataSourcePlugin;

    try {
      importedPlugin = await importDataSourcePlugin(dataSourceMeta);
    } catch (e) {
      console.log('Failed to import plugin module', e);
    }

    this.setState({ plugin: importedPlugin });
  }

  async componentDidMount() {
    const { loadDataSource, pageId } = this.props;
    if (isNaN(pageId)) {
      this.setState({ loadError: 'Invalid ID' });
      return;
    }
    try {
      await loadDataSource(pageId);
      if (!this.state.plugin) {
        await this.loadPlugin();
      }
    } catch (err) {
      this.setState({ loadError: err });
    }
  }

  onSubmit = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

    await this.props.updateDataSource({ ...this.props.dataSource });

    this.testDataSource();
  };

  onTest = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

    this.testDataSource();
  };

  onDelete = () => {
    appEvents.emit(CoreEvents.showConfirmModal, {
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

  onModelChange = (dataSource: DataSourceSettings) => {
    this.props.dataSourceLoaded(dataSource);
  };

  isReadOnly() {
    return this.props.dataSource.readOnly === true;
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
    const dsApi = await getDatasourceSrv().get(this.props.dataSource.name);

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

  get hasDataSource() {
    return this.props.dataSource.id > 0;
  }

  renderLoadError(loadError: any) {
    let showDelete = false;
    let msg = loadError.toString();
    if (loadError.data) {
      if (loadError.data.message) {
        msg = loadError.data.message;
      }
    } else if (isString(loadError)) {
      showDelete = true;
    }

    const node = {
      text: msg,
      subTitle: 'Data Source Error',
      icon: 'fa fa-fw fa-warning',
    };
    const nav = {
      node: node,
      main: node,
    };

    return (
      <Page navModel={nav}>
        <Page.Contents>
          <div>
            <div className="gf-form-button-row">
              {showDelete && (
                <button type="submit" className="btn btn-danger" onClick={this.onDelete}>
                  Delete
                </button>
              )}
              <a className="btn btn-inverse" href="datasources">
                Back
              </a>
            </div>
          </div>
        </Page.Contents>
      </Page>
    );
  }

  renderConfigPageBody(page: string) {
    const { plugin } = this.state;
    if (!plugin || !plugin.configPages) {
      return null; // still loading
    }

    for (const p of plugin.configPages) {
      if (p.id === page) {
        return <p.body plugin={plugin} query={this.props.query} />;
      }
    }

    return <div>Page Not Found: {page}</div>;
  }

  renderSettings() {
    const { dataSourceMeta, setDataSourceName, setIsDefault, dataSource } = this.props;
    const { testingMessage, testingStatus, plugin } = this.state;

    return (
      <form onSubmit={this.onSubmit}>
        {this.isReadOnly() && this.renderIsReadOnlyMessage()}
        {dataSourceMeta.state && (
          <div className="gf-form">
            <label className="gf-form-label width-10">Plugin state</label>
            <label className="gf-form-label gf-form-label--transparent">
              <PluginStateinfo state={dataSourceMeta.state} />
            </label>
          </div>
        )}

        <BasicSettings
          dataSourceName={dataSource.name}
          isDefault={dataSource.isDefault}
          onDefaultChange={state => setIsDefault(state)}
          onNameChange={name => setDataSourceName(name)}
        />

        {plugin && (
          <PluginSettings
            plugin={plugin}
            dataSource={dataSource}
            dataSourceMeta={dataSourceMeta}
            onModelChange={this.onModelChange}
          />
        )}

        <div className="gf-form-group">
          {testingMessage && (
            <div className={`alert-${testingStatus} alert`} aria-label="Datasource settings page Alert">
              <div className="alert-icon">
                {testingStatus === 'error' ? (
                  <i className="fa fa-exclamation-triangle" />
                ) : (
                  <i className="fa fa-check" />
                )}
              </div>
              <div className="alert-body">
                <div className="alert-title" aria-label="Datasource settings page Alert message">
                  {testingMessage}
                </div>
              </div>
            </div>
          )}
        </div>

        <ButtonRow
          onSubmit={event => this.onSubmit(event)}
          isReadOnly={this.isReadOnly()}
          onDelete={this.onDelete}
          onTest={event => this.onTest(event)}
        />
      </form>
    );
  }

  render() {
    const { navModel, page } = this.props;
    const { loadError } = this.state;

    if (loadError) {
      return this.renderLoadError(loadError);
    }

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={!this.hasDataSource}>
          {this.hasDataSource && <div>{page ? this.renderConfigPageBody(page) : this.renderSettings()}</div>}
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  const pageId = getRouteParamsId(state.location);
  const dataSource = getDataSource(state.dataSources, pageId);
  const page = state.location.query.page as string;

  return {
    navModel: getNavModel(
      state.navIndex,
      page ? `datasource-page-${page}` : `datasource-settings-${pageId}`,
      getDataSourceLoadingNav('settings')
    ),
    dataSource: getDataSource(state.dataSources, pageId),
    dataSourceMeta: getDataSourceMeta(state.dataSources, dataSource.type),
    pageId: pageId,
    query: state.location.query,
    page,
  };
}

const mapDispatchToProps = {
  deleteDataSource,
  loadDataSource,
  setDataSourceName,
  updateDataSource,
  setIsDefault,
  dataSourceLoaded,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(DataSourceSettingsPage)
);
