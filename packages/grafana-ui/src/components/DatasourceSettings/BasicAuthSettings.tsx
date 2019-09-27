import React from 'react';
import { DatasourceHttpSettingsProps } from './types';
import { FormField } from '../FormField/FormField';
import { SecretFormField } from '../SecretFormFied/SecretFormField';

export const DatasourceHttpBasicAuthSettings: React.FC<DatasourceHttpSettingsProps> = ({
  datasourceConfig,
  onChange,
}) => {
  const password = datasourceConfig.secureJsonData ? datasourceConfig.secureJsonData.basicAuthPassword : '';

  const onPasswordReset = () => {
    onChange({
      ...datasourceConfig,
      basicAuthPassword: '',
      secureJsonData: {
        ...datasourceConfig.secureJsonData,
        basicAuthPassword: '',
      },
      secureJsonFields: {
        ...datasourceConfig.secureJsonFields,
        basicAuthPassword: false,
      },
    });
  };

  const onPasswordChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    onChange({
      ...datasourceConfig,
      secureJsonData: {
        ...datasourceConfig.secureJsonData,
        basicAuthPassword: event.currentTarget.value,
      },
    });
  };

  return (
    <>
      <div className="gf-form">
        <FormField
          label="User"
          labelWidth={10}
          placeholder="user"
          value={datasourceConfig.basicAuthUser}
          onChange={event => onChange({ ...datasourceConfig, basicAuthUser: event.currentTarget.value })}
        />
      </div>
      <div className="gf-form">
        <SecretFormField
          isConfigured={
            !!datasourceConfig.basicAuthPassword ||
            !!(datasourceConfig.secureJsonFields && datasourceConfig.secureJsonFields.basicAuthPassword)
          }
          value={password || ''}
          inputWidth={18}
          labelWidth={10}
          onReset={onPasswordReset}
          onChange={onPasswordChange}
        />
      </div>
    </>
  );
};
