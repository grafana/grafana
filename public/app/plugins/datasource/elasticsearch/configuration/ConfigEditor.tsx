import React, { useEffect } from 'react';

import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { Alert, DataSourceHttpSettings } from '@grafana/ui';
import { SIGV4DataSourceSecureJsonData } from '@grafana/ui/src/components/DataSourceSettings/types';
import { config } from 'app/core/config';

import { ElasticsearchOptions } from '../types';
import { isSupportedVersion } from '../utils';

import { DataLinks } from './DataLinks';
import { ElasticDetails } from './ElasticDetails';
import { LogsConfig } from './LogsConfig';
import { coerceOptions, isValidOptions } from './utils';

export type Props = DataSourcePluginOptionsEditorProps<ElasticsearchOptions, SIGV4DataSourceSecureJsonData>;

export const ConfigEditor = (props: Props) => {
  const { options: originalOptions, onOptionsChange } = props;
  const options = coerceOptions(originalOptions);

  useEffect(() => {
    if (!isValidOptions(originalOptions)) {
      onOptionsChange(coerceOptions(originalOptions));
    }

    // We can't enforce the eslint rule here because we only want to run this once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const supportedVersion = isSupportedVersion(options.jsonData.esVersion);

  return (
    <>
      {options.access === 'direct' && (
        <Alert title="Error" severity="error">
          Browser access mode in the Elasticsearch datasource is no longer available. Switch to server access mode.
        </Alert>
      )}
      {!supportedVersion && (
        <Alert title="Deprecation notice" severity="error">
          {`Support for Elasticsearch versions after their end-of-life (currently versions < 7.10) was removed`}
        </Alert>
      )}
      <DataSourceHttpSettings
        defaultUrl="http://localhost:9200"
        dataSourceConfig={options}
        showAccessOptions
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
        renderSigV4Editor={<SIGV4ConnectionConfig {...props}></SIGV4ConnectionConfig>}
      />

      <ElasticDetails value={options} onChange={onOptionsChange} />

      <LogsConfig
        value={options.jsonData}
        onChange={(newValue) =>
          onOptionsChange({
            ...options,
            jsonData: newValue,
          })
        }
      />

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
    </>
  );
};
