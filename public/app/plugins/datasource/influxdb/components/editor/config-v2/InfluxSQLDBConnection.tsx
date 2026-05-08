import { omit } from 'lodash';
import { useEffect, useState } from 'react';

import {
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Input, SecretInput, Field, Space, Box } from '@grafana/ui';

import {
  trackInfluxDBConfigV2SQLDBDetailsDatabaseInputField,
  trackInfluxDBConfigV2SQLDBDetailsTokenInputField,
} from './tracking';
import { type Props } from './types';

export const InfluxSQLDBConnection = (props: Props) => {
  const { options, validation } = props;
  const { secureJsonData, secureJsonFields } = options;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const tokenConfigured = Boolean(secureJsonFields?.token);
  const tokenEntered = Boolean(secureJsonData?.token);

  useEffect(() => {
    if (!validation) {
      return;
    }
    if (options.jsonData.dbName) {
      setFieldErrors((prev) => omit(prev, 'dbName'));
    }
    if (tokenConfigured || tokenEntered) {
      setFieldErrors((prev) => omit(prev, 'token'));
    }
    return validation.registerValidation(() => {
      const errors: Record<string, string> = {};
      if (!options.jsonData.dbName) {
        errors.dbName = 'Database is required';
      }
      if (!tokenConfigured && !tokenEntered) {
        errors.token = 'Token is required';
      }
      setFieldErrors(errors);
      return Object.keys(errors).length === 0;
    });
  }, [options.jsonData.dbName, tokenConfigured, tokenEntered, validation]);

  return (
    <Box width="50%">
      <Field label="Database" required noMargin invalid={!!fieldErrors.dbName} error={fieldErrors.dbName}>
        <Input
          id="database"
          placeholder="mydb"
          value={options.jsonData.dbName}
          onChange={onUpdateDatasourceJsonDataOption(props, 'dbName')}
          onBlur={trackInfluxDBConfigV2SQLDBDetailsDatabaseInputField}
        />
      </Field>
      <Space v={2} />
      <Field label="Token" required noMargin invalid={!!fieldErrors.token} error={fieldErrors.token}>
        <SecretInput
          id="token"
          isConfigured={tokenConfigured}
          onBlur={trackInfluxDBConfigV2SQLDBDetailsTokenInputField}
          onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
          onReset={() => updateDatasourcePluginResetOption(props, 'token')}
          value={secureJsonData?.token || ''}
        />
      </Field>
    </Box>
  );
};
