import React from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

import { useStyles } from '../..';
import { HttpSettingsProps } from './types';
import { FormField } from '../FormField/FormField';
import { SecretFormField } from '../SecretFormField/SecretFormField';

export const BasicAuthSettings: React.FC<HttpSettingsProps> = ({ dataSourceConfig, onChange }) => {
  const password = dataSourceConfig.secureJsonData ? dataSourceConfig.secureJsonData.basicAuthPassword : '';

  const onPasswordReset = () => {
    onChange({
      ...dataSourceConfig,
      basicAuthPassword: '',
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

  const styles = useStyles(getStyles);

  return (
    <>
      <div className={styles.form}>
        <FormField
          label="User"
          labelWidth={10}
          inputWidth={18}
          placeholder="user"
          value={dataSourceConfig.basicAuthUser}
          onChange={(event) => onChange({ ...dataSourceConfig, basicAuthUser: event.currentTarget.value })}
        />
      </div>
      <div className={styles.form}>
        <SecretFormField
          isConfigured={
            !!dataSourceConfig.basicAuthPassword ||
            !!(dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.basicAuthPassword)
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

const getStyles = (theme: GrafanaTheme) => {
  return {
    form: css`
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      text-align: left;
      position: relative;
      margin-bottom: ${theme.v2.spacing(0.5)};
    `,
  };
};
