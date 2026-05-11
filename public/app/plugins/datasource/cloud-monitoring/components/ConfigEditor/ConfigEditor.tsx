import { memo } from 'react';

import {
  type DataSourcePluginOptionsEditorProps,
  type DataSourceSettings,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import {
  AuthConfig,
  type DataSourceOptions,
  type DataSourceSecureJsonData,
  GOOGLE_AUTH_TYPE_OPTIONS,
} from '@grafana/google-sdk';
import { ConfigSection, DataSourceDescription } from '@grafana/plugin-ui';
import { config, reportInteraction } from '@grafana/runtime';
import { Divider, Field, Input, SecureSocksProxySettings, Stack } from '@grafana/ui';

import { type CloudMonitoringOptions, type CloudMonitoringSecureJsonData } from '../../types/types';

export type Props = DataSourcePluginOptionsEditorProps<CloudMonitoringOptions, CloudMonitoringSecureJsonData>;

const OAUTH_PASSTHROUGH = 'oauthPassthrough';

const AUTH_OPTIONS = [
  ...GOOGLE_AUTH_TYPE_OPTIONS,
  { label: 'Forward OAuth Identity', value: OAUTH_PASSTHROUGH },
];

export const ConfigEditor = memo(({ options, onOptionsChange }: Props) => {
  const onAuthenticationTypeChange = (newOptions: DataSourceSettings<DataSourceOptions, DataSourceSecureJsonData>) => {
    if (newOptions.jsonData.privateKeyPath || newOptions.secureJsonFields['privateKey']) {
      reportInteraction('grafana_cloud_monitoring_config_changed', {
        authenticationType: 'JWT',
        privateKey: newOptions.secureJsonFields['privateKey'],
        privateKeyPath: !!newOptions.jsonData.privateKeyPath,
      });
    }
    onOptionsChange({
      ...newOptions,
      jsonData: {
        ...newOptions.jsonData,
        oauthPassThru: newOptions.jsonData.authenticationType === OAUTH_PASSTHROUGH,
      },
    });
  };

  const isOAuthPassthrough = options.jsonData.authenticationType === OAUTH_PASSTHROUGH;
  const showImpersonation = !isOAuthPassthrough;

  return (
    <>
      <DataSourceDescription
        dataSourceName="Google Cloud Monitoring"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/google-cloud-monitoring/"
        hasRequiredFields
      />
      <Divider />
      <AuthConfig
        options={options}
        onOptionsChange={onAuthenticationTypeChange}
        authOptions={AUTH_OPTIONS}
        showServiceAccountImpersonationConfig={showImpersonation}
      />
      {isOAuthPassthrough && (
        <Field noMargin label="Default project" description="Required when using OAuth Passthrough authentication.">
          <Input
            id="defaultProject"
            width={60}
            value={options.jsonData.defaultProject ?? ''}
            onChange={(event) =>
              updateDatasourcePluginJsonDataOption(
                { options, onOptionsChange },
                'defaultProject',
                event.currentTarget.value
              )
            }
            placeholder="my-gcp-project"
          />
        </Field>
      )}
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
