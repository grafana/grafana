import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { InlineFieldRow, InlineField, Input, SecretInput } from '@grafana/ui';

import { InfluxOptions, InfluxSecureJsonData } from '../../../types';

import {
  trackInfluxDBConfigV2InfluxQLDBDetailsDatabaseInputField,
  trackInfluxDBConfigV2InfluxQLDBDetailsPasswordInputField,
  trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField,
} from './tracking';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions, InfluxSecureJsonData>;

export const InfluxInfluxQLDBConnection = (props: Props) => {
  const { options, onOptionsChange } = props;

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Database" labelWidth={30} grow>
          <Input
            value={options.jsonData.dbName}
            onChange={(event) => {
              onOptionsChange({
                ...options,
                database: '',
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
            value={options.secureJsonData?.password || ''}
            onReset={() => updateDatasourcePluginResetOption(props, 'password')}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
            onBlur={trackInfluxDBConfigV2InfluxQLDBDetailsPasswordInputField}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
