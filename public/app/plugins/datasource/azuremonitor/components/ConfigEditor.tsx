import React, { PureComponent } from 'react';

import { DataSourcePluginOptionsEditorProps, SelectableValue, updateDatasourcePluginOption } from '@grafana/data';
import { getBackendSrv, getTemplateSrv, isFetchError, TemplateSrv } from '@grafana/runtime';
import { Alert, SecureSocksProxySettings } from '@grafana/ui';
import { config } from 'app/core/config';

import ResponseParser from '../azure_monitor/response_parser';
import {
  AzureAPIResponse,
  AzureDataSourceJsonData,
  AzureDataSourceSecureJsonData,
  AzureDataSourceSettings,
  Subscription,
} from '../types';
import { routeNames } from '../utils/common';

import { MonitorConfig } from './MonitorConfig';

export type Props = DataSourcePluginOptionsEditorProps<AzureDataSourceJsonData, AzureDataSourceSecureJsonData>;

interface ErrorMessage {
  title: string;
  description: string;
  details?: string;
}

export interface State {
  unsaved: boolean;
  error?: ErrorMessage;
}

export class ConfigEditor extends PureComponent<Props, State> {
  templateSrv: TemplateSrv = getTemplateSrv();
  baseURL: string;

  constructor(props: Props) {
    super(props);

    this.state = {
      unsaved: false,
    };
    this.baseURL = `/api/datasources/${this.props.options.id}/resources/${routeNames.azureMonitor}/subscriptions`;
  }

  private updateOptions = (optionsFunc: (options: AzureDataSourceSettings) => AzureDataSourceSettings): void => {
    const updated = optionsFunc(this.props.options);
    this.props.onOptionsChange(updated);

    this.setState({ unsaved: true });
  };

  private saveOptions = async (): Promise<void> => {
    if (this.state.unsaved) {
      await getBackendSrv()
        .put(`/api/datasources/${this.props.options.id}`, this.props.options)
        .then((result: { datasource: AzureDataSourceSettings }) => {
          updateDatasourcePluginOption(this.props, 'version', result.datasource.version);
        });

      this.setState({ unsaved: false });
    }
  };

  private getSubscriptions = async (): Promise<Array<SelectableValue<string>>> => {
    await this.saveOptions();

    const query = `?api-version=2019-03-01`;
    try {
      const result = await getBackendSrv()
        .fetch<AzureAPIResponse<Subscription>>({
          url: this.baseURL + query,
          method: 'GET',
        })
        .toPromise();

      this.setState({ error: undefined });
      return ResponseParser.parseSubscriptionsForSelect(result);
    } catch (err) {
      if (isFetchError(err)) {
        this.setState({
          error: {
            title: 'Error requesting subscriptions',
            description: 'Could not request subscriptions from Azure. Check your credentials and try again.',
            details: err?.data?.message,
          },
        });
      }
      return Promise.resolve([]);
    }
  };

  render() {
    const { options, onOptionsChange } = this.props;
    const { error } = this.state;

    return (
      <>
        <MonitorConfig options={options} updateOptions={this.updateOptions} getSubscriptions={this.getSubscriptions} />
        {error && (
          <Alert severity="error" title={error.title}>
            <p>{error.description}</p>
            {error.details && <details style={{ whiteSpace: 'pre-wrap' }}>{error.details}</details>}
          </Alert>
        )}
        {config.secureSocksDSProxyEnabled && (
          <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
        )}
      </>
    );
  }
}

export default ConfigEditor;
