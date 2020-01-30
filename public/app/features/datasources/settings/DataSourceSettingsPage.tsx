// Libraries
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import isString from 'lodash/isString';
import { e2e } from '@grafana/e2e';
// Components
import Page from 'app/core/components/Page/Page';
import { GenericDataSourcePlugin, PluginSettings } from './PluginSettings';
import BasicSettings from './BasicSettings';
import ButtonRow from './ButtonRow';
// Services & Utils
import appEvents from 'app/core/app_events';
// Actions & selectors
import { getDataSource, getDataSourceMeta } from '../state/selectors';
import {
  deleteDataSource,
  loadDataSource,
  updateDataSource,
  initDataSourceSettings,
  testDataSource,
} from '../state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';
// Types
import { CoreEvents, StoreState } from 'app/types/';
import { UrlQueryMap } from '@grafana/runtime';
import { DataSourcePluginMeta, DataSourceSettings, NavModel } from '@grafana/data';
import { getDataSourceLoadingNav } from '../state/navModel';
import PluginStateinfo from 'app/features/plugins/PluginStateInfo';
import { dataSourceLoaded, setDataSourceName, setIsDefault } from '../state/reducers';
import { connectWithCleanUp } from 'app/core/components/connectWithCleanUp';

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
  initDataSourceSettings: typeof initDataSourceSettings;
  testDataSource: typeof testDataSource;
  plugin?: GenericDataSourcePlugin;
  query: UrlQueryMap;
  page?: string;
  testingStatus?: {
    message?: string;
    status?: string;
  };
  loadError?: Error | string;
}

export class DataSourceSettingsPage extends PureComponent<Props> {
  componentDidMount() {
    const { initDataSourceSettings, pageId } = this.props;
    initDataSourceSettings(pageId);
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

  testDataSource() {
    const { dataSource, testDataSource } = this.props;
    testDataSource(dataSource.name);
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
    const { plugin } = this.props;
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
    const { dataSourceMeta, setDataSourceName, setIsDefault, dataSource, testingStatus, plugin } = this.props;

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
          {testingStatus && testingStatus.message && (
            <div className={`alert-${testingStatus.status} alert`} aria-label={e2e.pages.DataSource.selectors.alert}>
              <div className="alert-icon">
                {testingStatus.status === 'error' ? (
                  <i className="fa fa-exclamation-triangle" />
                ) : (
                  <i className="fa fa-check" />
                )}
              </div>
              <div className="alert-body">
                <div className="alert-title" aria-label={e2e.pages.DataSource.selectors.alertMessage}>
                  {testingStatus.message}
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
    const { navModel, page, loadError } = this.props;

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
  const { plugin, loadError, testingStatus } = state.dataSourceSettings;

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
    plugin,
    loadError,
    testingStatus,
  };
}

const mapDispatchToProps = {
  deleteDataSource,
  loadDataSource,
  setDataSourceName,
  updateDataSource,
  setIsDefault,
  dataSourceLoaded,
  initDataSourceSettings,
  testDataSource,
};

export default hot(module)(
  connectWithCleanUp(mapStateToProps, mapDispatchToProps, state => state.dataSourceSettings)(DataSourceSettingsPage)
);
