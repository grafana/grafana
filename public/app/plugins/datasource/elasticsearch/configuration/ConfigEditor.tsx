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
import { config } from '@grafana/runtime';
import { Alert, Divider, SecureSocksProxySettings } from '@grafana/ui';

import { ElasticsearchOptions } from '../types';

import { DataLinks } from './DataLinks';
import { ElasticDetails } from './ElasticDetails';
import { LogsConfig } from './LogsConfig';
import { coerceOptions, isValidOptions } from './utils';
import { css } from '@emotion/css';

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
      <Divider spacing={4} />
      <ConnectionSettings config={options} onChange={onOptionsChange} urlPlaceholder="http://localhost:9200" />
      <Divider spacing={4} />
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
      <Divider spacing={4} />
      <ConfigSection
        title="Additional settings"
        description="Additional settings are optional settings that can be configured for more control over your data source."
        isCollapsible={true}
        isInitiallyOpen
      >
        <AdvancedHttpSettings config={options} onChange={onOptionsChange} />
        <div className={styles.dividerInvisible}>
          <Divider spacing={3} />
        </div>
        {config.secureSocksDSProxyEnabled && (
          <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
        )}
        <ElasticDetails value={options} onChange={onOptionsChange} />
        <div className={styles.dividerInvisible}>
          <Divider spacing={3} />
        </div>
        <LogsConfig
          value={options.jsonData}
          onChange={(newValue) =>
            onOptionsChange({
              ...options,
              jsonData: newValue,
            })
          }
        />
        <div className={styles.dividerInvisible}>
          <Divider spacing={3} />
        </div>
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

const styles = {
  dividerInvisible: css({
    '> hr': {
      border: 'none'
    }
  })
}
