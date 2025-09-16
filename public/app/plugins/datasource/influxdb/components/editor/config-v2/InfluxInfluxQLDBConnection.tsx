import {
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { InlineFieldRow, InlineField, Input, SecretInput } from '@grafana/ui';

import { DB_SETTINGS_LABEL_WIDTH } from './constants';
import {
  trackInfluxDBConfigV2InfluxQLDBDetailsDatabaseInputField,
  trackInfluxDBConfigV2InfluxQLDBDetailsPasswordInputField,
  trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField,
} from './tracking';
import { Props } from './types';

export const InfluxInfluxQLDBConnection = (props: Props) => {
  const { options } = props;

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Database" labelWidth={DB_SETTINGS_LABEL_WIDTH} grow required>
          <Input
            id="database"
            placeholder="mydb"
            value={options.jsonData.dbName}
            onChange={onUpdateDatasourceJsonDataOption(props, 'dbName')}
            onBlur={trackInfluxDBConfigV2InfluxQLDBDetailsDatabaseInputField}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="User" labelWidth={DB_SETTINGS_LABEL_WIDTH} grow required>
          <Input
            id="user"
            placeholder="myuser"
            value={options.user || ''}
            onChange={onUpdateDatasourceOption(props, 'user')}
            onBlur={trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label="Password"
          labelWidth={DB_SETTINGS_LABEL_WIDTH}
          tooltip="Enter the token used to query the database. You can find this on the Tokens page in the InfluxDB UI."
          grow
          required
        >
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
