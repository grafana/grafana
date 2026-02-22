import {
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Input, SecretInput, Field, Space, Box } from '@grafana/ui';

import {
  trackInfluxDBConfigV2InfluxQLDBDetailsDatabaseInputField,
  trackInfluxDBConfigV2InfluxQLDBDetailsPasswordInputField,
  trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField,
} from './tracking';
import { Props } from './types';

export const InfluxInfluxQLDBConnection = (props: Props) => {
  const { options } = props;

  return (
    <Box width="50%">
      <Field label="Database" required noMargin>
        <Input
          id="database"
          placeholder="mydb"
          value={options.jsonData.dbName}
          onChange={onUpdateDatasourceJsonDataOption(props, 'dbName')}
          onBlur={trackInfluxDBConfigV2InfluxQLDBDetailsDatabaseInputField}
        />
      </Field>
      <Space v={2} />
      <Field label="User" required noMargin>
        <Input
          id="user"
          placeholder="myuser"
          value={options.user || ''}
          onChange={onUpdateDatasourceOption(props, 'user')}
          onBlur={trackInfluxDBConfigV2InfluxQLDBDetailsUserInputField}
        />
      </Field>
      <Space v={2} />
      <Field label="Password" required noMargin>
        <SecretInput
          id="password"
          isConfigured={Boolean(options.secureJsonFields && options.secureJsonFields.password)}
          value={options.secureJsonData?.password || ''}
          onReset={() => updateDatasourcePluginResetOption(props, 'password')}
          onChange={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
          onBlur={trackInfluxDBConfigV2InfluxQLDBDetailsPasswordInputField}
        />
      </Field>
    </Box>
  );
};
