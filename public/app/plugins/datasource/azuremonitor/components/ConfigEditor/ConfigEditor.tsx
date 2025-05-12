import { useState } from 'react';

import { DataSourcePluginOptionsEditorProps, SelectableValue, updateDatasourcePluginOption } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';
import { ConfigSection, DataSourceDescription } from '@grafana/plugin-ui';
import { getBackendSrv, isFetchError, config } from '@grafana/runtime';
import { Alert, Divider, SecureSocksProxySettings } from '@grafana/ui';

import ResponseParser from '../../azure_monitor/response_parser';
import {
  AzureAPIResponse,
  AzureMonitorDataSourceJsonData,
  AzureMonitorDataSourceSecureJsonData,
  AzureMonitorDataSourceSettings,
  Subscription,
} from '../../types';
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

export const ConfigEditor = (props: Props) => {
  const [unsaved, setUnsaved] = useState(false);
  const [error, setError] = useState<ErrorMessage | undefined>(undefined);
  const { t } = useTranslate();
  const baseURL = `/api/datasources/${props.options.id}/resources/${routeNames.azureMonitor}/subscriptions`;

  const updateOptions = (
    optionsFunc: (options: AzureMonitorDataSourceSettings) => AzureMonitorDataSourceSettings
  ): void => {
    const updated = optionsFunc(props.options);
    props.onOptionsChange(updated);
    setUnsaved(true);
  };

  const saveOptions = async () => {
    if (unsaved) {
      await getBackendSrv()
        .put(`/api/datasources/${props.options.id}`, props.options)
        .then((result: { datasource: AzureMonitorDataSourceSettings }) => {
          updateDatasourcePluginOption(props, 'version', result.datasource.version);
        });

      setUnsaved(false);
    }
  };

  const getSubscriptions = async (): Promise<Array<SelectableValue<string>>> => {
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
      return Promise.resolve([]);
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
      <MonitorConfig options={props.options} updateOptions={updateOptions} getSubscriptions={getSubscriptions} />
      {error && (
        <Alert severity="error" title={error.title}>
          <p>{error.description}</p>
          {error.details && <details style={{ whiteSpace: 'pre-wrap' }}>{error.details}</details>}
        </Alert>
      )}
      {config.secureSocksDSProxyEnabled && (
        <>
          <Divider />
          <ConfigSection
            title={t('components.config-editor.title-additional-settings', 'Additional settings')}
            description={t(
              'components.config-editor.description-additional-settings',
              'Additional settings are optional settings that can be configured for more control over your data source. This includes Secure Socks Proxy.'
            )}
            isCollapsible={true}
            isInitiallyOpen={props.options.jsonData.enableSecureSocksProxy !== undefined}
          >
            <SecureSocksProxySettings options={props.options} onOptionsChange={props.onOptionsChange} />
          </ConfigSection>
        </>
      )}
    </>
  );
};

export default ConfigEditor;
