import { memo, useState } from 'react';

import {
  type DataSourcePluginOptionsEditorProps,
  type SelectableValue,
  updateDatasourcePluginOption,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { AdvancedHttpSettings, ConfigSection, DataSourceDescription } from '@grafana/plugin-ui';
import { getBackendSrv, isFetchError, config } from '@grafana/runtime';
import { Alert, Divider, SecureSocksProxySettings } from '@grafana/ui';

import ResponseParser from '../../azure_monitor/response_parser';
import {
  type AzureAPIResponse,
  type AzureMonitorDataSourceJsonData,
  type AzureMonitorDataSourceSecureJsonData,
  type AzureMonitorDataSourceSettings,
  type Subscription,
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

export const ConfigEditor = memo(function ConfigEditor(props: Props) {
  const { options, onOptionsChange } = props;
  const [unsaved, setUnsaved] = useState(false);
  const [error, setError] = useState<ErrorMessage | undefined>(undefined);

  const baseURL = `/api/datasources/uid/${options.uid}/resources/${routeNames.azureMonitor}/subscriptions`;

  function updateOptions(
    optionsFunc: (options: AzureMonitorDataSourceSettings) => AzureMonitorDataSourceSettings
  ): void {
    const updated = optionsFunc(options);
    onOptionsChange(updated);
    setUnsaved(true);
  }

  async function saveOptions(): Promise<void> {
    if (unsaved) {
      await getBackendSrv()
        .put(`/api/datasources/uid/${options.uid}`, options)
        .then((result: { datasource: AzureMonitorDataSourceSettings }) => {
          updateDatasourcePluginOption(props, 'version', result.datasource.version);
        });

      setUnsaved(false);
    }
  }

  async function getSubscriptions(): Promise<Array<SelectableValue<string>>> {
    await saveOptions();

    const query = `?api-version=2019-03-01`;
    try {
      const result = await getBackendSrv()
        .fetch<AzureAPIResponse<Subscription>>({
          url: baseURL + query,
          method: 'GET',
        })
        .toPromise();

      setError(undefined);
      return ResponseParser.parseSubscriptionsForSelect(result);
    } catch (err) {
      if (isFetchError(err)) {
        setError({
          title: 'Error requesting subscriptions',
          description: 'Could not request subscriptions from Azure. Check your credentials and try again.',
          details: err?.data?.message,
        });
      }
      return [];
    }
  }

  return (
    <>
      <DataSourceDescription
        dataSourceName="Azure Monitor"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/azure-monitor/"
        hasRequiredFields
      />
      <Divider />
      <MonitorConfig options={options} updateOptions={updateOptions} getSubscriptions={getSubscriptions} />
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
});

export default ConfigEditor;
