import React, { PureComponent } from 'react';
import { isString } from 'lodash';
// Components
import Page from 'app/core/components/Page/Page';
import { PluginSettings } from './PluginSettings';
import BasicSettings from './BasicSettings';
import ButtonRow from './ButtonRow';
// Services & Utils
import appEvents from 'app/core/app_events';
// Actions & selectors
import { getDataSource, getDataSourceMeta } from '../state/selectors';
import {
  deleteDataSource,
  initDataSourceSettings,
  loadDataSource,
  testDataSource,
  updateDataSource,
} from '../state/actions';
import { getNavModel } from 'app/core/selectors/navModel';

// Types
import { StoreState } from 'app/types/';
import { DataSourceSettings } from '@grafana/data';
import { Alert, Button, LinkButton } from '@grafana/ui';
import { getDataSourceLoadingNav } from '../state/navModel';
import PluginStateinfo from 'app/features/plugins/PluginStateInfo';
import { dataSourceLoaded, setDataSourceName, setIsDefault } from '../state/reducers';
import { selectors } from '@grafana/e2e-selectors';
import { CloudInfoBox } from './CloudInfoBox';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { connect, ConnectedProps } from 'react-redux';
import { cleanUpAction } from 'app/core/actions/cleanUp';
import { ShowConfirmModalEvent } from '../../../types/events';

export interface OwnProps extends GrafanaRouteComponentProps<{ id: string }> {}

function mapStateToProps(state: StoreState, props: OwnProps) {
  const dataSourceId = props.match.params.id;
  const params = new URLSearchParams(props.location.search);
  const dataSource = getDataSource(state.dataSources, dataSourceId);
  const { plugin, loadError, testingStatus } = state.dataSourceSettings;
  const page = params.get('page');

  return {
    navModel: getNavModel(
      state.navIndex,
      page ? `datasource-page-${page}` : `datasource-settings-${dataSourceId}`,
      getDataSourceLoadingNav('settings')
    ),
    dataSource: getDataSource(state.dataSources, dataSourceId),
    dataSourceMeta: getDataSourceMeta(state.dataSources, dataSource.type),
    dataSourceId: parseInt(dataSourceId, 10),
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
  cleanUpAction,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export class DataSourceSettingsPage extends PureComponent<Props> {
  componentDidMount() {
    const { initDataSourceSettings, dataSourceId } = this.props;
    initDataSourceSettings(dataSourceId);
  }

  componentWillUnmount() {
    this.props.cleanUpAction({
      stateSelector: (state) => state.dataSourceSettings,
    });
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
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Delete',
        text: 'Are you sure you want to delete this data source?',
        yesText: 'Delete',
        icon: 'trash-alt',
        onConfirm: () => {
          this.confirmDelete();
        },
      })
    );
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
      <Alert aria-label={selectors.pages.DataSource.readOnly} severity="info" title="Provisioned data source">
        This data source was added by config and cannot be modified using the UI. Please contact your server admin to
        update this data source.
      </Alert>
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
      icon: 'exclamation-triangle',
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
                <Button type="submit" variant="destructive" onClick={this.onDelete}>
                  Delete
                </Button>
              )}
              <LinkButton variant="link" href="datasources">
                Back
              </LinkButton>
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
        // Investigate is any plugins using this? We should change this interface
        return <p.body plugin={plugin} query={{}} />;
      }
    }

    return <div>Page not found: {page}</div>;
  }

  renderSettings() {
    const { dataSourceMeta, setDataSourceName, setIsDefault, dataSource, plugin, testingStatus } = this.props;

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

        <CloudInfoBox dataSource={dataSource} />

        <BasicSettings
          dataSourceName={dataSource.name}
          isDefault={dataSource.isDefault}
          onDefaultChange={(state) => setIsDefault(state)}
          onNameChange={(name) => setDataSourceName(name)}
        />

        {plugin && (
          <PluginSettings
            plugin={plugin}
            dataSource={dataSource}
            dataSourceMeta={dataSourceMeta}
            onModelChange={this.onModelChange}
          />
        )}

        <div className="gf-form-group p-t-2">
          {testingStatus?.message && (
            <Alert
              severity={testingStatus.status === 'error' ? 'error' : 'success'}
              title={testingStatus.message}
              aria-label={selectors.pages.DataSource.alert}
            >
              {testingStatus.details?.message ?? null}
              {testingStatus.details?.verboseMessage ? (
                <details style={{ whiteSpace: 'pre-wrap' }}>{testingStatus.details?.verboseMessage}</details>
              ) : null}
            </Alert>
          )}
        </div>

        <ButtonRow
          onSubmit={(event) => this.onSubmit(event)}
          isReadOnly={this.isReadOnly()}
          onDelete={this.onDelete}
          onTest={(event) => this.onTest(event)}
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
          {this.hasDataSource ? <div>{page ? this.renderConfigPageBody(page) : this.renderSettings()}</div> : null}
        </Page.Contents>
      </Page>
    );
  }
}

export default connector(DataSourceSettingsPage);
