import { SyntheticEvent, useState } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { ConfigSection, ConfigSubSection, DataSourceDescription, EditorStack } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { ConnectionLimits, Divider, TLSSecretsConfig, useMigrateDatabaseFields } from '@grafana/sql';
import {
  Collapse,
  Field,
  Icon,
  Input,
  Label,
  SecretInput,
  SecureSocksProxySettings,
  Switch,
  Tooltip,
} from '@grafana/ui';

import { MySQLOptions } from '../types';

export const ConfigurationEditor = (props: DataSourcePluginOptionsEditorProps<MySQLOptions>) => {
  const [isOpen, setIsOpen] = useState(true);

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

  const WIDTH_LONG = 40;

  return (
    <>
      <DataSourceDescription
        dataSourceName="MySQL"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/mysql/"
        hasRequiredFields={true}
      />

      <Divider />

      <Collapse collapsible label="User Permission" isOpen={isOpen} onToggle={() => setIsOpen((x) => !x)}>
        The database user should only be granted SELECT permissions on the specified database &amp; tables you want to
        query. <br />
        Grafana does not validate that queries are safe so queries can contain any SQL statement. For example,
        statements like <code>USE otherdb;</code> and <code>DROP TABLE user;</code> would be executed. <br />
        To protect against this we <strong>Highly</strong> recommend you create a specific MySQL user with restricted
        permissions. Check out the docs for more information.
      </Collapse>

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

        <Field label="Database name">
          <Input
            width={WIDTH_LONG}
            name="database"
            value={jsonData.database || ''}
            placeholder="Database"
            onChange={onUpdateDatasourceJsonDataOption(props, 'database')}
          />
        </Field>
      </ConfigSection>

      <Divider />

      <ConfigSection title="Authentication">
        <Field label="Username" required>
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

      {jsonData.tlsAuth || jsonData.tlsAuthWithCACert ? (
        <>
          <Divider />

          <ConfigSection title="TLS/SSL Auth Details">
            {jsonData.tlsAuth || jsonData.tlsAuthWithCACert ? (
              <TLSSecretsConfig
                showCACert={jsonData.tlsAuthWithCACert}
                showKeyPair={jsonData.tlsAuth}
                editorProps={props}
                labelWidth={WIDTH_LONG}
              />
            ) : null}
          </ConfigSection>
        </>
      ) : null}

      <Divider />

      <ConfigSection title="Additional settings" isCollapsible>
        <ConfigSubSection title="MySQL Options">
          <Field
            label={
              <Label>
                <EditorStack gap={0.5}>
                  <span>Session timezone</span>
                  <Tooltip
                    content={
                      <span>
                        Specify the timezone used in the database session, such as <code>Europe/Berlin</code> or
                        <code>+02:00</code>. Required if the timezone of the database (or the host of the database) is
                        set to something other than UTC. Set this to <code>+00:00</code> so Grafana can handle times
                        properly. Set the value used in the session with <code>SET time_zone=&apos;...&apos;</code>. If
                        you leave this field empty, the timezone will not be updated. You can find more information in
                        the MySQL documentation.
                      </span>
                    }
                  >
                    <Icon name="info-circle" size="sm" />
                  </Tooltip>
                </EditorStack>
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
                <EditorStack gap={0.5}>
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
                </EditorStack>
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
        </ConfigSubSection>

        <ConnectionLimits options={options} onOptionsChange={onOptionsChange} />

        {config.secureSocksDSProxyEnabled && (
          <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
        )}
      </ConfigSection>
    </>
  );
};
