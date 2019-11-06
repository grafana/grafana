import React, { useEffect } from 'react';
import { DataSourceHttpSettings } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ElasticsearchOptions } from '../types';
import { defaultMaxConcurrentShardRequests, ElasticDetails } from './ElasticDetails';
import { LogsConfig } from './LogsConfig';

export type Props = DataSourcePluginOptionsEditorProps<ElasticsearchOptions>;
export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  // Apply some defaults on initial render
  useEffect(() => {
    const esVersion = options.jsonData.esVersion || 5;
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        timeField: options.jsonData.timeField || '@timestamp',
        esVersion,
        maxConcurrentShardRequests:
          options.jsonData.maxConcurrentShardRequests || defaultMaxConcurrentShardRequests(esVersion),
        logMessageField: options.jsonData.logMessageField || '',
        logLevelField: options.jsonData.logLevelField || '',
      },
    });
  }, []);

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl={'http://localhost:3100'}
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
      />

      <ElasticDetails value={options} onChange={onOptionsChange} />

      <LogsConfig
        value={options.jsonData}
        onChange={newValue =>
          onOptionsChange({
            ...options,
            jsonData: newValue,
          })
        }
      />
    </>
  );
};
