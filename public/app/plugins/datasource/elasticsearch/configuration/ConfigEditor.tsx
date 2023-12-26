import React, { useEffect } from 'react';

import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import {
  AdvancedHttpSettings,
  Auth,
  AuthMethod,
  ConfigSection,
  ConnectionSettings,
  convertLegacyAuthProps,
  DataSourceDescription,
} from '@grafana/experimental';
import { Alert, SecureSocksProxySettings } from '@grafana/ui';
import { Divider } from 'app/core/components/Divider';
import { config } from 'app/core/config';

import { ElasticsearchOptions } from '../types';

import { DataLinks } from './DataLinks';
import { ElasticDetails } from './ElasticDetails';
import { LogsConfig } from './LogsConfig';
import { coerceOptions, isValidOptions } from './utils';

export type Props = DataSourcePluginOptionsEditorProps<ElasticsearchOptions>;

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  useEffect(() => {
    if (!isValidOptions(options)) {
      onOptionsChange(coerceOptions(options));
    }
  }, [onOptionsChange, options]);

  const authProps = convertLegacyAuthProps({
    config: options,
    onChange: onOptionsChange,
  });
  if (config.sigV4AuthEnabled) {
    authProps.customMethods = [
      {
        id: 'custom-sigv4',
        label: 'SigV4 auth',
        description: 'AWS Signature Version 4 authentication',
        component: <SIGV4ConnectionConfig inExperimentalAuthComponent={true} {...props} />,
      },
    ];
    authProps.selectedMethod = options.jsonData.sigV4Auth ? 'custom-sigv4' : authProps.selectedMethod;
  }

  return (
    <>
      {options.access === 'direct' && (
        <Alert title="Error" severity="error">
          Browser access mode in the Elasticsearch datasource is no longer available. Switch to server access mode.
        </Alert>
      )}
      <DataSourceDescription
        dataSourceName="Elasticsearch"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/elasticsearch"
        hasRequiredFields={false}
      />
      <Divider />
      <ConnectionSettings config={options} onChange={onOptionsChange} urlPlaceholder="http://localhost:9200" />
      <Divider />
      <Auth
        {...authProps}
        onAuthMethodSelect={(method) => {
          onOptionsChange({
            ...options,
            basicAuth: method === AuthMethod.BasicAuth,
            withCredentials: method === AuthMethod.CrossSiteCredentials,
            jsonData: {
              ...options.jsonData,
              sigV4Auth: method === 'custom-sigv4',
              oauthPassThru: method === AuthMethod.OAuthForward,
            },
          });
        }}
      />
      <Divider />
      <ConfigSection
        title="Additional settings"
        description="Additional settings are optional settings that can be configured for more control over your data source."
        isCollapsible={true}
        isInitiallyOpen
      >
        <AdvancedHttpSettings config={options} onChange={onOptionsChange} />
        <Divider hideLine />
        {config.secureSocksDSProxyEnabled && (
          <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
        )}
        <ElasticDetails value={options} onChange={onOptionsChange} />
        <Divider hideLine />
        <LogsConfig
          value={options.jsonData}
          onChange={(newValue) =>
            onOptionsChange({
              ...options,
              jsonData: newValue,
            })
          }
        />
        <Divider hideLine />
        <DataLinks
          value={options.jsonData.dataLinks}
          onChange={(newValue) => {
            onOptionsChange({
              ...options,
              jsonData: {
                ...options.jsonData,
                dataLinks: newValue,
              },
            });
          }}
        />
      </ConfigSection>
    </>
  );
};
