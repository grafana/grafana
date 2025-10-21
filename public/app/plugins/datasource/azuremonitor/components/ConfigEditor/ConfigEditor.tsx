import { PureComponent } from 'react';

import { DataSourcePluginOptionsEditorProps, SelectableValue, updateDatasourcePluginOption } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AdvancedHttpSettings, ConfigSection, DataSourceDescription } from '@grafana/plugin-ui';
import { getBackendSrv, getTemplateSrv, isFetchError, TemplateSrv, config } from '@grafana/runtime';
import { Alert, Divider, SecureSocksProxySettings } from '@grafana/ui';

import ResponseParser from '../../azure_monitor/response_parser';
import {
  AzureAPIResponse,
  AzureMonitorDataSourceJsonData,
  AzureMonitorDataSourceSecureJsonData,
  AzureMonitorDataSourceSettings,
  Subscription,
} from '../../types/types';
import { routeNames } from '../../utils/common';

import { MonitorConfig } from './MonitorConfig';

export type Props = DataSourcePluginOptionsEditorProps<
  AzureMonitorDataSourceJsonData,
  AzureMonitorDataSourceSecureJsonData
>;

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

  private updateOptions = (
    optionsFunc: (options: AzureMonitorDataSourceSettings) => AzureMonitorDataSourceSettings
  ): void => {
    const updated = optionsFunc(this.props.options);
    this.props.onOptionsChange(updated);

    this.setState({ unsaved: true });
  };

  private saveOptions = async (): Promise<void> => {
    if (this.state.unsaved) {
      await getBackendSrv()
        .put(`/api/datasources/${this.props.options.id}`, this.props.options)
        .then((result: { datasource: AzureMonitorDataSourceSettings }) => {
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
        <DataSourceDescription
          dataSourceName="Azure Monitor"
          docsLink="https://grafana.com/docs/grafana/latest/datasources/azure-monitor/"
          hasRequiredFields
        />
        <Divider />
        <MonitorConfig options={options} updateOptions={this.updateOptions} getSubscriptions={this.getSubscriptions} />
        {error && (
          <Alert severity="error" title={error.title}>
            <p>{error.description}</p>
            {error.details && <details style={{ whiteSpace: 'pre-wrap' }}>{error.details}</details>}
          </Alert>
        )}
        <>
          <Divider />
          <ConfigSection
            title={t('components.config-editor.title-additional-settings', 'Additional settings')}
            description={t(
              'components.config-editor.description-additional-settings',
              'Additional settings are optional settings that can be configured for more control over your data source. This includes Secure Socks Proxy, request timeout, and forwarded cookies.'
            )}
            isCollapsible={true}
            isInitiallyOpen={
              options.jsonData.enableSecureSocksProxy !== undefined ||
              options.jsonData.timeout !== undefined ||
              options.jsonData.keepCookies !== undefined
            }
          >
            <AdvancedHttpSettings config={options} onChange={onOptionsChange} />
            {config.secureSocksDSProxyEnabled && (
              <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
            )}
          </ConfigSection>
        </>
      </>
    );
  }
}

export default ConfigEditor;
