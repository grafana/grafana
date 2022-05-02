import React, { useEffect } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { Alert, DataSourceHttpSettings } from '@grafana/ui';
import { config } from 'app/core/config';

import { ElasticsearchOptions } from '../types';
import { isDeprecatedVersion } from '../utils';

import { DataLinks } from './DataLinks';
import { ElasticDetails } from './ElasticDetails';
import { LogsConfig } from './LogsConfig';
import { coerceOptions, isValidOptions } from './utils';

export type Props = DataSourcePluginOptionsEditorProps<ElasticsearchOptions>;

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

  const deprecatedVersion = isDeprecatedVersion(options.jsonData.esVersion);

  return (
    <>
      {options.access === 'direct' && (
        <Alert title="Deprecation Notice" severity="warning">
          Browser access mode in the Elasticsearch datasource is deprecated and will be removed in a future release.
        </Alert>
      )}
      {deprecatedVersion && (
        <Alert title="Deprecation notice" severity="warning">
          {`Support for Elasticsearch versions after their end-of-life (currently versions < 7.10) is deprecated and will be removed in a future release.`}
        </Alert>
      )}

      <DataSourceHttpSettings
        defaultUrl="http://localhost:9200"
        dataSourceConfig={options}
        showAccessOptions
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
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
