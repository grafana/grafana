import React, { useEffect, useRef } from 'react';

import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ConfigSection } from '@grafana/experimental';
import { Alert, DataSourceHttpSettings } from '@grafana/ui';
import { Divider } from 'app/core/components/Divider';
import { config } from 'app/core/config';

import { ElasticsearchOptions } from '../types';

import { DataLinks } from './DataLinks';
import { ElasticDetails } from './ElasticDetails';
import { LogsConfig } from './LogsConfig';
import { coerceOptions, isValidOptions } from './utils';

export type Props = DataSourcePluginOptionsEditorProps<ElasticsearchOptions>;

export const ConfigEditor = (props: Props) => {
  // we decide on whether to show access options or not at the point when the config page opens.
  // whatever happens while the page is open, this decision does not change.
  // (we do this to avoid situations where you switch access-mode and suddenly
  // the access-mode-select-box vanishes)
  const showAccessOptions = useRef(props.options.access === 'direct');

  const { options, onOptionsChange } = props;

  useEffect(() => {
    if (!isValidOptions(options)) {
      onOptionsChange(coerceOptions(options));
    }
  }, [onOptionsChange, options]);

  return (
    <>
      {options.access === 'direct' && (
        <Alert title="Error" severity="error">
          Browser access mode in the Elasticsearch datasource is no longer available. Switch to server access mode.
        </Alert>
      )}

      <Divider />

      <DataSourceHttpSettings
        defaultUrl="http://localhost:9200"
        dataSourceConfig={options}
        showAccessOptions={showAccessOptions.current}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
        renderSigV4Editor={<SIGV4ConnectionConfig {...props}></SIGV4ConnectionConfig>}
        secureSocksDSProxyEnabled={config.secureSocksDSProxyEnabled}
      />

      <Divider />

      <ConfigSection
        title="Additional settings"
        description="Additional settings are optional settings that can be configured for more control over your data source."
        isCollapsible={true}
        isInitiallyOpen
      >
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
