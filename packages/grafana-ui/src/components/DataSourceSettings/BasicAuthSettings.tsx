import React from 'react';

import { selectors } from '@grafana/e2e-selectors/src';

import { InlineField, Input, SecretInput } from '../..';
import { FormField } from '../FormField/FormField';
import { SecretFormField } from '../SecretFormField/SecretFormField';

import { HttpSettingsProps } from './types';

export const BasicAuthSettings: React.FC<HttpSettingsProps> = ({ dataSourceConfig, onChange }) => {
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
      <InlineField style={{ maxWidth: '600px', marginRight: 0 }} label="User" labelWidth={10} grow={true}>
        <Input
          label="User"
          placeholder="user"
          value={dataSourceConfig.basicAuthUser}
          onChange={(event) => onChange({ ...dataSourceConfig, basicAuthUser: event.currentTarget.value })}
        />
      </InlineField>
      <InlineField style={{ maxWidth: '600px', width: '100%' }} label={'Password'} labelWidth={10} grow={true}>
        <SecretInput
          isConfigured={!!(dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.basicAuthPassword)}
          value={password || ''}
          onReset={onPasswordReset}
          onChange={onPasswordChange}
        />
      </InlineField>
    </>
  );
};
