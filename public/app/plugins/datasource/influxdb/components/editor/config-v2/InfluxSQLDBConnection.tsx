import {
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Input, SecretInput, Field, Box } from '@grafana/ui';

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
      <Box marginBottom={2}>
        <Field label="Database" required noMargin>
          <Input
            id="database"
            placeholder="mydb"
            value={options.jsonData.dbName}
            onChange={onUpdateDatasourceJsonDataOption(props, 'dbName')}
            onBlur={trackInfluxDBConfigV2SQLDBDetailsDatabaseInputField}
          />
        </Field>
      </Box>
      <Box marginBottom={2}>
        <Field label="Token" required noMargin>
          <SecretInput
            id="token"
            isConfigured={Boolean(secureJsonFields && secureJsonFields.token)}
            onBlur={trackInfluxDBConfigV2SQLDBDetailsTokenInputField}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
            onReset={() => updateDatasourcePluginResetOption(props, 'token')}
            value={secureJsonData?.token || ''}
          />
        </Field>
      </Box>
    </>
  );
};
