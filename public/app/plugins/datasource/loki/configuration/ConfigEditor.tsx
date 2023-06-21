import React, { useCallback } from 'react';

import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { AlertingSettings, DataSourceHttpSettings } from '@grafana/ui';

import { LokiOptions } from '../types';

import { DerivedFields } from './DerivedFields';
import { QuerySettings } from './QuerySettings';

export type Props = DataSourcePluginOptionsEditorProps<LokiOptions>;

const makeJsonUpdater =
  <T extends any>(field: keyof LokiOptions) =>
  (options: DataSourceSettings<LokiOptions>, value: T): DataSourceSettings<LokiOptions> => {
    return {
      ...options,
      jsonData: {
        ...options.jsonData,
        [field]: value,
      },
    };
  };

const setMaxLines = makeJsonUpdater('maxLines');
const setPredefinedOperations = makeJsonUpdater('predefinedOperations');
const setDerivedFields = makeJsonUpdater('derivedFields');

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  const updatePredefinedOperations = useCallback(
    (value: string) => {
      reportInteraction('grafana_loki_predefined_operations_changed', { value });
      onOptionsChange(setPredefinedOperations(options, value));
    },
    [options, onOptionsChange]
  );

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl={'http://localhost:3100'}
        dataSourceConfig={options}
        showAccessOptions={false}
        onChange={onOptionsChange}
        secureSocksDSProxyEnabled={config.secureSocksDSProxyEnabled}
      />

      <AlertingSettings<LokiOptions> options={options} onOptionsChange={onOptionsChange} />

      <QuerySettings
        maxLines={options.jsonData.maxLines || ''}
        onMaxLinedChange={(value) => onOptionsChange(setMaxLines(options, value))}
        predefinedOperations={options.jsonData.predefinedOperations || ''}
        onPredefinedOperationsChange={updatePredefinedOperations}
      />

      <DerivedFields
        fields={options.jsonData.derivedFields}
        onChange={(value) => onOptionsChange(setDerivedFields(options, value))}
      />
    </>
  );
};
