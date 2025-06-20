import { onUpdateDatasourceSecureJsonDataOption, updateDatasourcePluginResetOption } from '@grafana/data';
import { InlineFieldRow, InlineField, Input, SecretInput } from '@grafana/ui';

import {
  trackInfluxDBConfigV2SQLDBDetailsDatabaseInputField,
  trackInfluxDBConfigV2SQLDBDetailsTokenInputField,
} from './tracking';
import { Props } from './types';

export const InfluxSQLDBConnection = (props: Props) => {
  const { options, onOptionsChange } = props;
  const { secureJsonData, secureJsonFields } = options;

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
                jsonData: {
                  ...options.jsonData,
                  dbName: event.currentTarget.value,
                },
              });
            }}
            onBlur={trackInfluxDBConfigV2SQLDBDetailsDatabaseInputField}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField labelWidth={30} label="Token" grow>
          <SecretInput
            id="token"
            isConfigured={Boolean(secureJsonFields && secureJsonFields.token)}
            onBlur={() => {
              onOptionsChange({
                ...options,
                secureJsonFields: {
                  ...options.secureJsonFields,
                  token: true,
                },
              });
              trackInfluxDBConfigV2SQLDBDetailsTokenInputField();
            }}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
            onReset={() => updateDatasourcePluginResetOption(props, 'token')}
            value={secureJsonData?.token || ''}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
