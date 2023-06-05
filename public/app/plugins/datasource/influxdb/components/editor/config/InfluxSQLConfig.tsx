import React from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { FieldSet, InlineField, SecretInput } from '@grafana/ui';

import { InfluxOptions, InfluxSecureJsonData } from '../../../types';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions, InfluxSecureJsonData>;

export const InfluxSqlConfig = (props: Props) => {
  const {
    options: { secureJsonData, secureJsonFields },
  } = props;

  return (
    <div>
      <FieldSet label="FlightSQL Connection" width={400}>
        <InlineField labelWidth={20} label="Token">
          <SecretInput
            width={40}
            name="token"
            type="text"
            value={secureJsonData?.token || ''}
            onReset={() => updateDatasourcePluginResetOption(props, 'token')}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
            isConfigured={secureJsonFields?.token}
          />
        </InlineField>
      </FieldSet>
    </div>
  );
};
