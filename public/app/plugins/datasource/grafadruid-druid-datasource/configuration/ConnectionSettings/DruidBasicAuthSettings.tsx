import React, { ChangeEvent } from 'react';
import { LegacyForms, FieldSet } from '@grafana/ui';
import { ConnectionSettingsProps } from './types';

const { FormField, SecretFormField } = LegacyForms;

export const DruidBasicAuthSettings = (props: ConnectionSettingsProps) => {
  const { options, onOptionsChange } = props;
  const { settings, secretSettings, secretSettingsFields } = options;
  const onSettingChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    switch (event.target.name) {
      case 'user': {
        settings.basicAuthUser = value;
        break;
      }
    }
    onOptionsChange({ ...options, settings: settings });
  };
  const onSecretSettingChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    switch (event.target.name) {
      case 'password': {
        secretSettings.basicAuthPassword = value;
        break;
      }
    }
    onOptionsChange({ ...options, secretSettings: secretSettings });
  };
  const onPasswordReset = () => {
    onOptionsChange({
      ...options,
      secretSettingsFields: {
        ...secretSettings,
        basicAuthPassword: false,
      },
      secretSettings: {
        ...secretSettings,
        basicAuthPassword: '',
      },
    });
  };
  return (
    <FieldSet label="Basic Authentication">
      <FormField
        label="User"
        name="user"
        type="text"
        placeholder="the user. e.g: jdoe"
        labelWidth={11}
        inputWidth={20}
        value={settings.basicAuthUser}
        onChange={onSettingChange}
      />
      <SecretFormField
        label="Password"
        name="password"
        type="password"
        placeholder="the password"
        labelWidth={11}
        inputWidth={20}
        isConfigured={(secretSettingsFields && secretSettingsFields.basicAuthPassword) as boolean}
        value={secretSettings.basicAuthPassword || ''}
        onChange={onSecretSettingChange}
        onReset={onPasswordReset}
      />
    </FieldSet>
  );
};
