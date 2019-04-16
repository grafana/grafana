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
import { NavModel, Plugin, StoreState } from 'app/types/';
import { DataSourceSettings } from '@grafana/ui/src/types/';
import { getDataSourceLoadingNav } from '../state/navModel';
import PluginStateinfo from 'app/features/plugins/PluginStateInfo';

export interface Props {
  navModel: NavModel;
  dataSource: DataSourceSettings;
  dataSourceMeta: Plugin;
  pageId: number;
  deleteDataSource: typeof deleteDataSource;
  loadDataSource: typeof loadDataSource;
  setDataSourceName: typeof setDataSourceName;
  updateDataSource: typeof updateDataSource;
  setIsDefault: typeof setIsDefault;
}

interface State {
  dataSource: DataSourceSettings;
  isTesting?: boolean;
  testingMessage?: string;
  testingStatus?: string;
}

export class DataSourceSettingsPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      dataSource: {} as DataSourceSettings,
    };
  }

  async componentDidMount() {
    const { loadDataSource, pageId } = this.props;

    await loadDataSource(pageId);
  }

  componentDidUpdate(prevProps: Props) {
    const { dataSource } = this.props;

    if (prevProps.dataSource !== dataSource) {
      this.setState({ dataSource });
    }
  }

  onSubmit = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

    await this.props.updateDataSource({ ...this.state.dataSource, name: this.props.dataSource.name });

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

  render() {
    const { dataSource, dataSourceMeta, navModel, setDataSourceName, setIsDefault } = this.props;
    const { testingMessage, testingStatus } = this.state;

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

                {dataSourceMeta.module && (
                  <PluginSettings
                    dataSource={dataSource}
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
