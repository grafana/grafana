import React, { PureComponent } from 'react';
import {
  DataSourcePluginOptionsEditorProps,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginOption,
  updateDatasourcePluginResetOption,
  updateDatasourcePluginSecureJsonDataOption,
} from '@grafana/data';
import { Alert } from '@grafana/ui';
import { MonitorConfig } from './MonitorConfig';
import { AnalyticsConfig } from './AnalyticsConfig';
import { getBackendSrv, getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import { InsightsConfig } from './InsightsConfig';
import ResponseParser from '../azure_monitor/response_parser';
import { AzureDataSourceJsonData, AzureDataSourceSecureJsonData, AzureDataSourceSettings } from '../types';
import { isAppInsightsConfigured } from '../credentials';
import { routeNames } from '../utils/common';

export type Props = DataSourcePluginOptionsEditorProps<AzureDataSourceJsonData, AzureDataSourceSecureJsonData>;

interface ErrorMessage {
  title: string;
  description: string;
  details?: string;
}

export interface State {
  unsaved: boolean;
  appInsightsInitiallyConfigured: boolean;
  error?: ErrorMessage;
}

export class ConfigEditor extends PureComponent<Props, State> {
  templateSrv: TemplateSrv = getTemplateSrv();
  baseURL: string;

  constructor(props: Props) {
    super(props);

    this.state = {
      unsaved: false,
      appInsightsInitiallyConfigured: isAppInsightsConfigured(props.options),
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
        .fetch({
          url: this.baseURL + query,
          method: 'GET',
        })
        .toPromise();

      this.setState({ error: undefined });
      return ResponseParser.parseSubscriptionsForSelect(result);
    } catch (err) {
      this.setState({
        error: {
          title: 'Error requesting subscriptions',
          description: 'Could not request subscriptions from Azure. Check your credentials and try again.',
          details: err?.data?.message,
        },
      });
      return Promise.resolve([]);
    }
  };

  // TODO: Used only by InsightsConfig
  private onUpdateJsonDataOption = (key: keyof AzureDataSourceJsonData) => (
    event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    updateDatasourcePluginJsonDataOption(this.props, key, event.currentTarget.value);
  };

  // TODO: Used only by InsightsConfig
  private onUpdateSecureJsonDataOption = (key: keyof AzureDataSourceSecureJsonData) => (
    event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    updateDatasourcePluginSecureJsonDataOption(this.props, key, event.currentTarget.value);
  };

  // TODO: Used only by InsightsConfig
  private resetSecureKey = (key: keyof AzureDataSourceSecureJsonData) => {
    updateDatasourcePluginResetOption(this.props, key);
  };

  render() {
    const { options } = this.props;
    const { error } = this.state;

    return (
      <>
        <MonitorConfig options={options} updateOptions={this.updateOptions} getSubscriptions={this.getSubscriptions} />
        <AnalyticsConfig options={options} updateOptions={this.updateOptions} />
        {this.state.appInsightsInitiallyConfigured && (
          <InsightsConfig
            options={options}
            onUpdateJsonDataOption={this.onUpdateJsonDataOption}
            onUpdateSecureJsonDataOption={this.onUpdateSecureJsonDataOption}
            onResetOptionKey={this.resetSecureKey}
          />
        )}

        {error && (
          <Alert severity="error" title={error.title}>
            <p>{error.description}</p>
            {error.details && <details style={{ whiteSpace: 'pre-wrap' }}>{error.details}</details>}
          </Alert>
        )}
      </>
    );
  }
}

export default ConfigEditor;
