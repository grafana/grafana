import React, { PureComponent } from 'react';
import {
  DataSourcePluginOptionsEditorProps,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginOption,
  updateDatasourcePluginResetOption,
  updateDatasourcePluginSecureJsonDataOption,
} from '@grafana/data';
import { MonitorConfig } from './MonitorConfig';
import { AnalyticsConfig } from './AnalyticsConfig';
import { getBackendSrv, getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import { InsightsConfig } from './InsightsConfig';
import ResponseParser from '../azure_monitor/response_parser';
import { AzureDataSourceJsonData, AzureDataSourceSecureJsonData, AzureDataSourceSettings } from '../types';

export type Props = DataSourcePluginOptionsEditorProps<AzureDataSourceJsonData, AzureDataSourceSecureJsonData>;

export class ConfigEditor extends PureComponent<Props> {
  templateSrv: TemplateSrv = getTemplateSrv();

  constructor(props: Props) {
    super(props);

    if (this.props.options.id) {
      updateDatasourcePluginOption(this.props, 'url', '/api/datasources/proxy/' + this.props.options.id);
    }
  }

  private updateOptions = (optionsFunc: (options: AzureDataSourceSettings) => AzureDataSourceSettings): void => {
    const updated = optionsFunc(this.props.options);
    this.props.onOptionsChange(updated);
  };

  private getSubscriptions = async (route?: string): Promise<Array<SelectableValue<string>>> => {
    // TODO: Save credentials only if changed
    await getBackendSrv()
      .put(`/api/datasources/${this.props.options.id}`, this.props.options)
      .then((result: { datasource: AzureDataSourceSettings }) => {
        updateDatasourcePluginOption(this.props, 'version', result.datasource.version);
      });

    const url = `/${route || this.props.options.jsonData.cloudName}/subscriptions?api-version=2019-03-01`;

    const result = await getBackendSrv().datasourceRequest({
      url: this.props.options.url + url,
      method: 'GET',
    });

    return ResponseParser.parseSubscriptionsForSelect(result);
  };

  private getWorkspaces = async (subscriptionId: string): Promise<Array<SelectableValue<string>>> => {
    // TODO: Make sure credentials saved
    const { azureLogAnalyticsSameAs, cloudName } = this.props.options.jsonData;

    let azureMonitorUrl;
    if (azureLogAnalyticsSameAs) {
      const azureCloud = cloudName || 'azuremonitor';
      azureMonitorUrl = `/${azureCloud}/subscriptions`;
    } else {
      azureMonitorUrl = `/workspacesloganalytics/subscriptions`;
    }

    const workspaceListUrl =
      azureMonitorUrl +
      `/${subscriptionId}/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview`;

    const result = await getBackendSrv().datasourceRequest({
      url: this.props.options.url + workspaceListUrl,
      method: 'GET',
    });

    return ResponseParser.parseWorkspacesForSelect(result);
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
    // TODO: Clean up
    const { options } = this.props;
    options.jsonData.cloudName = options.jsonData.cloudName || 'azuremonitor';
    // This is bad, causes so many messy typing issues everwhere..
    options.secureJsonData = (options.secureJsonData || {}) as AzureDataSourceSecureJsonData;

    return (
      <>
        <MonitorConfig options={options} updateOptions={this.updateOptions} getSubscriptions={this.getSubscriptions} />

        <AnalyticsConfig
          options={options}
          updateOptions={this.updateOptions}
          getSubscriptions={this.getSubscriptions}
          getWorkspaces={this.getWorkspaces}
        />

        <InsightsConfig
          options={options}
          onUpdateJsonDataOption={this.onUpdateJsonDataOption}
          onUpdateSecureJsonDataOption={this.onUpdateSecureJsonDataOption}
          onResetOptionKey={this.resetSecureKey}
        />
      </>
    );
  }
}

export default ConfigEditor;
