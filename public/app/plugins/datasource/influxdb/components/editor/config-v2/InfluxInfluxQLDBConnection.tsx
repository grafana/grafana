import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { InlineFieldRow, InlineField, Input, SecretInput } from '@grafana/ui';

import { InfluxOptions } from '../../../types';

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
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="User" labelWidth={30} grow>
          <Input
            value={options.user || ''}
            onChange={(e) => onOptionsChange({ ...options, user: e.currentTarget.value })}
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
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
