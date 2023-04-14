import React from 'react';

import { InlineField } from '../..';
import { FormField } from '../FormField/FormField';
import { SecretFormField } from '../SecretFormField/SecretFormField';

import { HttpSettingsProps } from './types';

export const BasicAuthSettings = ({ dataSourceConfig, onChange }: HttpSettingsProps) => {
  const password = dataSourceConfig.secureJsonData ? dataSourceConfig.secureJsonData.basicAuthPassword : '';

  const onPasswordReset = () => {
    onChange({
      ...dataSourceConfig,
      secureJsonData: {
        ...dataSourceConfig.secureJsonData,
        basicAuthPassword: '',
      },
      secureJsonFields: {
        ...dataSourceConfig.secureJsonFields,
        basicAuthPassword: false,
      },
    });
  };

  const onPasswordChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    onChange({
      ...dataSourceConfig,
      secureJsonData: {
        ...dataSourceConfig.secureJsonData,
        basicAuthPassword: event.currentTarget.value,
      },
    });
  };

  return (
    <>
      <InlineField disabled={dataSourceConfig.readOnly}>
        <FormField
          label="User"
          labelWidth={10}
          inputWidth={18}
          placeholder="user"
          value={dataSourceConfig.basicAuthUser}
          onChange={(event) => onChange({ ...dataSourceConfig, basicAuthUser: event.currentTarget.value })}
        />
      </InlineField>
      <InlineField disabled={dataSourceConfig.readOnly}>
        <SecretFormField
          isConfigured={!!(dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.basicAuthPassword)}
          value={password || ''}
          inputWidth={18}
          labelWidth={10}
          onReset={onPasswordReset}
          onChange={onPasswordChange}
        />
      </InlineField>
    </>
  );
};
