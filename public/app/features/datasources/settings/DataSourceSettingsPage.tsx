// Libraries
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Components
import Page from 'app/core/components/Page/Page';
import PluginSettings from './PluginSettings';
import BasicSettings from './BasicSettings';
import ButtonRow from './ButtonRow';

// Services & Utils
import appEvents from 'app/core/app_events';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

// Actions & selectors
import { getDataSource, getDataSourceMeta } from '../state/selectors';
import { deleteDataSource, loadDataSource, setDataSourceName, setIsDefault, updateDataSource } from '../state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';

// Types
import { StoreState } from 'app/types/';
import { NavModel, DataSourceSettings, DataSourcePlugin, DataSourcePluginMeta } from '@grafana/ui';
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
  plugin?: DataSourcePlugin;
}

interface State {
  dataSource: DataSourceSettings;
  plugin: DataSourcePlugin;
  isTesting?: boolean;
  testingMessage?: string;
  testingStatus?: string;
}

export class DataSourceSettingsPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      dataSource: props.dataSource,
      plugin: props.plugin,
    };
  }

  async loadPlugin(pluginId?: string) {
    const { dataSourceMeta } = this.props;
    let importedPlugin: DataSourcePlugin;

    try {
      importedPlugin = await importDataSourcePlugin(dataSourceMeta);
    } catch (e) {
      console.log('Failed to import plugin module', e);
    }

    this.setState({ plugin: importedPlugin });
  }

  async componentDidMount() {
    const { loadDataSource, pageId } = this.props;
    await loadDataSource(pageId);
    if (!this.state.plugin) {
      await this.loadPlugin();
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { dataSource } = this.props;

    if (prevProps.dataSource !== dataSource) {
      this.setState({ dataSource });
    }
  }

  onSubmit = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

    await this.props.updateDataSource({ ...this.state.dataSource });

    this.testDataSource();
  };

  onTest = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

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

  onModelChange = (dataSource: DataSourceSettings) => {
    this.setState({ dataSource });
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

  get hasDataSource() {
    return this.state.dataSource.id > 0;
  }

  render() {
    const { dataSourceMeta, navModel, setDataSourceName, setIsDefault } = this.props;
    const { testingMessage, testingStatus, plugin, dataSource } = this.state;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={!this.hasDataSource}>
          {this.hasDataSource && (
            <div>
              <form onSubmit={this.onSubmit}>
                {this.isReadOnly() && this.renderIsReadOnlyMessage()}
                <PluginStateinfo state={dataSourceMeta.state} />

                <BasicSettings
                  dataSourceName={dataSource.name}
                  isDefault={dataSource.isDefault}
                  onDefaultChange={state => setIsDefault(state)}
                  onNameChange={name => setDataSourceName(name)}
                />

                {dataSourceMeta.module && plugin && (
                  <PluginSettings
                    plugin={plugin}
                    dataSource={this.state.dataSource}
                    dataSourceMeta={dataSourceMeta}
                    onModelChange={this.onModelChange}
                  />
                )}

                <div className="gf-form-group">
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
                  onTest={event => this.onTest(event)}
                />
              </form>
            </div>
          )}
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
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

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(DataSourceSettingsPage)
);
