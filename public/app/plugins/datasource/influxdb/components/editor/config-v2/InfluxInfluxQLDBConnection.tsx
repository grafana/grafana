import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { InlineFieldRow, InlineField, Input, SecretInput } from '@grafana/ui';

import { InfluxOptions } from '../../../types';

import {
  trackInfluxDBConfigV2InfluxQLDBDetailsDatabaseInputField,
  trackInfluxDBConfigV2InfluxQLDBDetailsPasswordInputField,
  trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField,
} from './trackingv2';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

export const InfluxInfluxQLDBConnection = ({ options, onOptionsChange }: Props) => {
  return (
    <>
      <InlineFieldRow>
        <InlineField label="Database" labelWidth={30} grow>
          <Input
            value={options.jsonData.dbName}
            onChange={(event) => {
              onOptionsChange({
                ...options,
                jsonData: {
                  ...options.jsonData,
                  dbName: event.currentTarget.value,
                },
              });
            }}
            onBlur={trackInfluxDBConfigV2InfluxQLDBDetailsDatabaseInputField}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="User" labelWidth={30} grow>
          <Input
            value={options.user || ''}
            onChange={(e) => onOptionsChange({ ...options, user: e.currentTarget.value })}
            onBlur={trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Password" labelWidth={30} grow>
          <SecretInput
            isConfigured={Boolean(options.secureJsonFields && options.secureJsonFields.password)}
            value={''}
            onReset={() => {}}
            onChange={() => {}}
            onBlur={trackInfluxDBConfigV2InfluxQLDBDetailsPasswordInputField}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
