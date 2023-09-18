import React, { SyntheticEvent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { ConfigSection, DataSourceDescription, Stack } from '@grafana/experimental';
import {
  Alert,
  Divider,
  Field,
  Icon,
  Input,
  Label,
  Link,
  SecretInput,
  SecureSocksProxySettings,
  Switch,
  Tooltip,
} from '@grafana/ui';
import { config } from 'app/core/config';
import { ConnectionLimits } from 'app/features/plugins/sql/components/configuration/ConnectionLimits';
import { TLSSecretsConfig } from 'app/features/plugins/sql/components/configuration/TLSSecretsConfig';
import { useMigrateDatabaseFields } from 'app/features/plugins/sql/components/configuration/useMigrateDatabaseFields';

import { MySQLOptions } from '../types';

export const ConfigurationEditor = (props: DataSourcePluginOptionsEditorProps<MySQLOptions>) => {
  const { options, onOptionsChange } = props;
  const jsonData = options.jsonData;

  useMigrateDatabaseFields(props);

  const onResetPassword = () => {
    updateDatasourcePluginResetOption(props, 'password');
  };

  const onDSOptionChanged = (property: keyof MySQLOptions) => {
    return (event: SyntheticEvent<HTMLInputElement>) => {
      onOptionsChange({ ...options, ...{ [property]: event.currentTarget.value } });
    };
  };

  const onSwitchChanged = (property: keyof MySQLOptions) => {
    return (event: SyntheticEvent<HTMLInputElement>) => {
      updateDatasourcePluginJsonDataOption(props, property, event.currentTarget.checked);
    };
  };

  const WIDTH_SHORT = 15;
  const WIDTH_LONG = 40;

  return (
    <>
      <DataSourceDescription
        dataSourceName="MySQL"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/mysql/"
        hasRequiredFields={false}
      />

      <Divider />

      <ConfigSection title="Connection">
        <Field label="Host URL" required>
          <Input
            width={WIDTH_LONG}
            name="host"
            type="text"
            value={options.url || ''}
            placeholder="localhost:3306"
            onChange={onDSOptionChanged('url')}
          />
        </Field>
      </ConfigSection>

      <Divider />

      <ConfigSection title="Authentication">
        <Field label="Database name">
          <Input
            width={WIDTH_LONG}
            name="database"
            value={jsonData.database || ''}
            placeholder="Database"
            onChange={onUpdateDatasourceJsonDataOption(props, 'database')}
          />
        </Field>

        <Field label="Username">
          <Input
            width={WIDTH_LONG}
            value={options.user || ''}
            placeholder="Username"
            onChange={onDSOptionChanged('user')}
          />
        </Field>

        <Field label="Password">
          <SecretInput
            width={WIDTH_LONG}
            placeholder="Password"
            isConfigured={options.secureJsonFields && options.secureJsonFields.password}
            onReset={onResetPassword}
            onBlur={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
          />
        </Field>

        <Field
          label="Use TLS Client Auth"
          description="Enables TLS authentication using client cert configured in secure json data."
        >
          <Switch onChange={onSwitchChanged('tlsAuth')} value={jsonData.tlsAuth || false} />
        </Field>

        <Field label="With CA Cert" description="Needed for verifying self-signed TLS Certs.">
          <Switch onChange={onSwitchChanged('tlsAuthWithCACert')} value={jsonData.tlsAuthWithCACert || false} />
        </Field>

        <Field
          label="Skip TLS Verification"
          description="When enabled, skips verification of the MySQL server's TLS certificate chain and host name."
        >
          <Switch onChange={onSwitchChanged('tlsSkipVerify')} value={jsonData.tlsSkipVerify || false} />
        </Field>

        <Field
          label="Allow Cleartext Passwords"
          description="Allows using the cleartext client side plugin if required by an account."
        >
          <Switch
            onChange={onSwitchChanged('allowCleartextPasswords')}
            value={jsonData.allowCleartextPasswords || false}
          />
        </Field>
      </ConfigSection>

      {config.secureSocksDSProxyEnabled && (
        <>
          <Divider />
          {config.secureSocksDSProxyEnabled && (
            <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
          )}
        </>
      )}

      {jsonData.tlsAuth || jsonData.tlsAuthWithCACert ? (
        <>
          <Divider />

          <ConfigSection title="TLS/SSL Auth Details">
            {jsonData.tlsAuth || jsonData.tlsAuthWithCACert ? (
              <TLSSecretsConfig
                showCACert={jsonData.tlsAuthWithCACert}
                showKeyPair={jsonData.tlsAuth}
                editorProps={props}
                labelWidth={25}
              />
            ) : null}
          </ConfigSection>
        </>
      ) : null}

      <Divider />

      <ConfigSection title="Additional settings">
        <Field
          label={
            <Label>
              <Stack gap={0.5}>
                <span>Session timezone</span>
                <Tooltip
                  content={
                    <span>
                      Specify the time zone used in the database session, e.g. <code>Europe/Berlin</code> or
                      <code>+02:00</code>. This is necessary, if the timezone of the database (or the host of the
                      database) is set to something other than UTC. The value is set in the session with
                      <code>SET time_zone=&apos;...&apos;</code>. If you leave this field empty, the timezone is not
                      updated. You can find more information in the MySQL documentation.
                    </span>
                  }
                >
                  <Icon name="info-circle" size="sm" />
                </Tooltip>
              </Stack>
            </Label>
          }
        >
          <Input
            width={WIDTH_LONG}
            value={jsonData.timezone || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'timezone')}
            placeholder="Europe/Berlin or +02:00"
          />
        </Field>

        <Field
          label={
            <Label>
              <Stack gap={0.5}>
                <span>Min time interval</span>
                <Tooltip
                  content={
                    <span>
                      A lower limit for the auto group by time interval. Recommended to be set to write frequency, for
                      example
                      <code>1m</code> if your data is written every minute.
                    </span>
                  }
                >
                  <Icon name="info-circle" size="sm" />
                </Tooltip>
              </Stack>
            </Label>
          }
          description="A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example 1m if your data is written every minute."
        >
          <Input
            width={WIDTH_LONG}
            placeholder="1m"
            value={jsonData.timeInterval || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
          />
        </Field>
      </ConfigSection>

      <Divider />

      <ConnectionLimits labelWidth={WIDTH_SHORT} options={options} onOptionsChange={onOptionsChange} />

      <Divider />

      <Alert title="User Permission" severity="info">
        The database user should only be granted SELECT permissions on the specified database &amp; tables you want to
        query. Grafana does not validate that queries are safe so queries can contain any SQL statement. For example,
        statements like <code>USE otherdb;</code> and <code>DROP TABLE user;</code> would be executed. To protect
        against this we <strong>Highly</strong> recommend you create a specific MySQL user with restricted permissions.
        Check out the{' '}
        <Link rel="noreferrer" target="_blank" href="http://docs.grafana.org/features/datasources/mysql/">
          MySQL Data Source Docs
        </Link>{' '}
        for more information.
      </Alert>
    </>
  );
};
