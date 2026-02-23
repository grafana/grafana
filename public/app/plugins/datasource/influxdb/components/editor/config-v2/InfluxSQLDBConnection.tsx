import {
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { InlineFieldRow, InlineField, Input, SecretInput } from '@grafana/ui';

import { DB_SETTINGS_LABEL_WIDTH } from './constants';
import {
  trackInfluxDBConfigV2SQLDBDetailsDatabaseInputField,
  trackInfluxDBConfigV2SQLDBDetailsTokenInputField,
} from './tracking';
import { Props } from './types';

export const InfluxSQLDBConnection = (props: Props) => {
  const { options } = props;
  const { secureJsonData, secureJsonFields } = options;

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Database" labelWidth={DB_SETTINGS_LABEL_WIDTH} grow required>
          <Input
            id="database"
            placeholder="mydb"
            value={options.jsonData.dbName}
            onChange={onUpdateDatasourceJsonDataOption(props, 'dbName')}
            onBlur={trackInfluxDBConfigV2SQLDBDetailsDatabaseInputField}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField labelWidth={DB_SETTINGS_LABEL_WIDTH} label="Token" grow required>
          <SecretInput
            id="token"
            isConfigured={Boolean(secureJsonFields && secureJsonFields.token)}
            onBlur={trackInfluxDBConfigV2SQLDBDetailsTokenInputField}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
            onReset={() => updateDatasourcePluginResetOption(props, 'token')}
            value={secureJsonData?.token || ''}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
