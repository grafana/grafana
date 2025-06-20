import { onUpdateDatasourceSecureJsonDataOption, updateDatasourcePluginResetOption } from '@grafana/data';
import { InlineFieldRow, InlineField, Input, SecretInput } from '@grafana/ui';

import {
  trackInfluxDBConfigV2InfluxQLDBDetailsDatabaseInputField,
  trackInfluxDBConfigV2InfluxQLDBDetailsPasswordInputField,
  trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField,
} from './tracking';
import { Props } from './types';

export const InfluxInfluxQLDBConnection = (props: Props) => {
  const { options, onOptionsChange } = props;

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Database" labelWidth={30} grow>
          <Input
            id="database"
            placeholder="mydb"
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
            id="user"
            placeholder="myuser"
            value={options.user || ''}
            onChange={(e) => onOptionsChange({ ...options, user: e.currentTarget.value })}
            onBlur={trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Password" labelWidth={30} grow>
          <SecretInput
            id="password"
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
