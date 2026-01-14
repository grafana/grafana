import { memo } from 'react';

import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { ConnectionConfig } from '@grafana/google-sdk';
import { ConfigSection, DataSourceDescription } from '@grafana/plugin-ui';
import { config, reportInteraction } from '@grafana/runtime';
import { Divider, Field, Input, SecureSocksProxySettings, Stack } from '@grafana/ui';

import { CloudMonitoringOptions, CloudMonitoringSecureJsonData } from '../../types/types';

export type Props = DataSourcePluginOptionsEditorProps<CloudMonitoringOptions, CloudMonitoringSecureJsonData>;

export const ConfigEditor = memo(({ options, onOptionsChange }: Props) => {
  const handleOnOptionsChange = (options: Props['options']) => {
    if (options.jsonData.privateKeyPath || options.secureJsonFields['privateKey']) {
      reportInteraction('grafana_cloud_monitoring_config_changed', {
        authenticationType: 'JWT',
        privateKey: options.secureJsonFields['privateKey'],
        privateKeyPath: !!options.jsonData.privateKeyPath,
      });
    }
    onOptionsChange(options);
  };

  return (
    <>
      <DataSourceDescription
        dataSourceName="Google Cloud Monitoring"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/google-cloud-monitoring/"
        hasRequiredFields
      />
      <Divider />
      <ConnectionConfig options={options} onOptionsChange={handleOnOptionsChange}></ConnectionConfig>
      {config.secureSocksDSProxyEnabled && (
        <>
          <Divider />
          <ConfigSection
            title="Additional settings"
            description="Additional settings are optional settings that can be configured for more control over your data source. This includes Secure Socks Proxy and Universe Domain."
            isCollapsible
            isInitiallyOpen={
              options.jsonData.enableSecureSocksProxy !== undefined || options.jsonData.universeDomain !== undefined
            }
          >
            <Stack direction={'column'}>
              <Field noMargin label="Universe Domain">
                <Input
                  width={50}
                  value={options.jsonData.universeDomain}
                  onChange={(event) =>
                    updateDatasourcePluginJsonDataOption(
                      { options, onOptionsChange },
                      'universeDomain',
                      event.currentTarget.value
                    )
                  }
                  placeholder="googleapis.com"
                ></Input>
              </Field>
              <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
            </Stack>
          </ConfigSection>
        </>
      )}
      <Divider />
    </>
  );
});
ConfigEditor.displayName = 'ConfigEditor';
