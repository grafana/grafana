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
import { StoreState, UrlQueryMap } from 'app/types/';
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
  query: UrlQueryMap;
}

interface State {
  dataSource: DataSourceSettings;
  plugin: DataSourcePlugin;
  isTesting?: boolean;
  testingMessage?: string;
  testingStatus?: string;
  navModelWithTabs?: NavModel; // If modified with tabs
  tab?: string;
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

      // Add Tabs to the navModel
      if (importedPlugin.configTabs && importedPlugin.configTabs.length) {
        const { navModel } = this.props;
        const path = navModel.node.url;
        const tabs = importedPlugin.configTabs.map(tab => {
          return {
            text: tab.title,
            icon: tab.icon,
            url: path + '?tab=' + tab.id,
            id: tab.id,
          };
        });
        const children = [...navModel.main.children]; // copy it first
        children.splice(1, 0, ...tabs); // add the tabs
        const main = {
          ...navModel.main,
          children,
        };
        this.setState({
          navModelWithTabs: {
            ...navModel,
            main,
          },
        });
      }
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
    const { dataSource, query } = this.props;
    const { navModelWithTabs } = this.state;

    if (prevProps.dataSource !== dataSource) {
      this.setState({ dataSource });
    }

    if (navModelWithTabs) {
      if (this.state.tab !== query.tab) {
        let found = false;
        let tab = query.tab as string;
        const children = navModelWithTabs.main.children.map(item => {
          if (item.id === tab) {
            found = true;
            return {
              ...item,
              active: true,
            };
          }
          return {
            ...item,
            active: false,
          };
        });
        if (!found) {
          children[0].active = true;
          tab = null;
        }
        navModelWithTabs.main.children = children; // TODO - immutable?
        this.setState({ navModelWithTabs, tab });
      }
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
    return Object.keys(this.props.dataSource).length > 0;
  }

  renderDashboards() {
    return <div>TODO, render the dashboard import...</div>;
  }

  renderTabBody(tab: string) {
    if (tab === 'dashboards') {
      return this.renderDashboards();
    }

    const { plugin } = this.state;
    if (!plugin || !plugin.addConfigTab) {
      return null; // still loading
    }

    for (const t of plugin.configTabs) {
      if (t.id === tab) {
        return <t.body plugin={plugin} query={this.props.query} />;
      }
    }

    return <div>Tab Not Found: {tab}</div>;
  }

  renderSettings() {
    const { dataSourceMeta, setDataSourceName, setIsDefault } = this.props;
    const { testingMessage, testingStatus, plugin, dataSource } = this.state;

    return (
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
    );
  }

  render() {
    const { navModel } = this.props;
    const { tab, navModelWithTabs } = this.state;
    return (
      <Page navModel={navModelWithTabs ? navModelWithTabs : navModel}>
        <Page.Contents isLoading={!this.hasDataSource}>
          {this.hasDataSource && <div>{tab ? this.renderTabBody(tab) : this.renderSettings()}</div>}
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
    query: state.location.query,
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
