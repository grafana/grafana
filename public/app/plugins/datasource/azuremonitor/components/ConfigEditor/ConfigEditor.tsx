import { ChangeEvent, PureComponent } from 'react';

import { DataSourcePluginOptionsEditorProps, SelectableValue, updateDatasourcePluginOption } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ConfigSection, DataSourceDescription } from '@grafana/plugin-ui';
import { getBackendSrv, getTemplateSrv, isFetchError, TemplateSrv, config } from '@grafana/runtime';
import { Alert, Divider, Field, Input, SecureSocksProxySettings } from '@grafana/ui';

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

    const onTimeoutChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (e.currentTarget.value?.trim() === '') {
        this.updateOptions((options) => ({
          ...options,
          jsonData: { ...options.jsonData, timeout: undefined },
        }));
      } else {
        const newVal = Number(e.currentTarget.value);
        if (!Number.isNaN(newVal)) {
          this.updateOptions((options) => ({
            ...options,
            jsonData: { ...options.jsonData, timeout: newVal },
          }));
        }
      }
    };

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
              'Additional settings are optional settings that can be configured for more control over your data source. This includes Secure Socks Proxy.'
            )}
            isCollapsible={true}
            isInitiallyOpen={options.jsonData.enableSecureSocksProxy !== undefined}
          >
            <Field
              label={t('components.config-editor.title-request-timeout', 'Request Timeout')}
              description={t(
                'components.config-editor.description-request-timeout',
                'Set the request timeout in seconds. Default is 30 seconds.'
              )}
            >
              <Input
                value={options.jsonData.timeout}
                type="number"
                className="width-15"
                // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                placeholder="30"
                onChange={onTimeoutChange}
              />
            </Field>
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
