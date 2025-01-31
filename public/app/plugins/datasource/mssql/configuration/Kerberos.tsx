import { SyntheticEvent } from 'react';

import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { ConfigSubSection } from '@grafana/plugin-ui';
import { FieldSet, Input, Field } from '@grafana/ui';

import { MSSQLAuthenticationType, MssqlOptions } from '../types';

export const UsernameMessage = (
  <span>
    Use the format <code>user@EXAMPLE.COM</code>. Realm is derived from the username.
  </span>
);

export const KerberosConfig = (props: DataSourcePluginOptionsEditorProps<MssqlOptions>) => {
  const { options: settings, onOptionsChange } = props;
  const jsonData = settings.jsonData;
  const LONG_WIDTH = 40;

  const keytabFilePath = jsonData?.keytabFilePath;
  const credentialCache = jsonData?.credentialCache;
  const credentialCacheLookupFile = jsonData?.credentialCacheLookupFile;

  const onKeytabFileChanged = (event: SyntheticEvent<HTMLInputElement>) => {
    updateDatasourcePluginJsonDataOption(props, 'keytabFilePath', event.currentTarget.value);
  };

  const onCredentialCacheChanged = (event: SyntheticEvent<HTMLInputElement>) => {
    updateDatasourcePluginJsonDataOption(props, 'credentialCache', event.currentTarget.value);
  };

  const onCredentialCacheFileChanged = (event: SyntheticEvent<HTMLInputElement>) => {
    updateDatasourcePluginJsonDataOption(props, 'credentialCacheLookupFile', event.currentTarget.value);
  };

  return (
    <>
      {jsonData.authenticationType === MSSQLAuthenticationType.kerberosKeytab && (
        <FieldSet label="Windows AD: Keytab">
          <Field
            label="Username"
            required
            invalid={!settings.user}
            error={'Username is required'}
            description={UsernameMessage}
          >
            <Input
              value={settings.user || ''}
              placeholder="name@EXAMPLE.COM"
              onChange={(e) => onOptionsChange({ ...settings, ...{ ['user']: e.currentTarget.value } })}
              width={LONG_WIDTH}
            />
          </Field>
          <Field label="Keytab file path" required invalid={!keytabFilePath} error={'Keytab file path is required'}>
            <Input
              placeholder="/home/grot/grot.keytab"
              onChange={onKeytabFileChanged}
              width={LONG_WIDTH}
              required
              value={keytabFilePath || ''}
            />
          </Field>
        </FieldSet>
      )}

      {jsonData.authenticationType === MSSQLAuthenticationType.kerberosCredentialCache && (
        <FieldSet label="Windows AD: Credential cache">
          <Field
            label="Credential cache path"
            required
            invalid={!credentialCache}
            error={'Credential cache path is required'}
          >
            <Input
              placeholder="/tmp/krb5cc_1000"
              onChange={onCredentialCacheChanged}
              width={LONG_WIDTH}
              value={credentialCache || ''}
              required
            />
          </Field>
        </FieldSet>
      )}

      {jsonData.authenticationType === MSSQLAuthenticationType.kerberosCredentialCacheLookupFile && (
        <FieldSet label="Windows AD: Credential cache file">
          <Field
            label="Username"
            required
            invalid={!settings.user}
            error={'Username is required'}
            description={UsernameMessage}
          >
            <Input
              value={settings.user || ''}
              placeholder="name@EXAMPLE.COM"
              onChange={(e) => onOptionsChange({ ...settings, ...{ ['user']: e.currentTarget.value } })}
              width={LONG_WIDTH}
            />
          </Field>
          <Field
            label="Credential cache file path"
            required
            invalid={!credentialCacheLookupFile}
            error={'Credential cache file path is required'}
          >
            <Input
              placeholder="/home/grot/cache.json"
              onChange={onCredentialCacheFileChanged}
              width={LONG_WIDTH}
              value={credentialCacheLookupFile || ''}
              required
            />
          </Field>
        </FieldSet>
      )}
    </>
  );
};

export const KerberosAdvancedSettings = (props: DataSourcePluginOptionsEditorProps<MssqlOptions>) => {
  const { options: settings } = props;
  const jsonData = settings.jsonData;
  const configFilePath = jsonData?.configFilePath;
  const LONG_WIDTH = 40;
  const onUDPLimitChanged = (val: number) => {
    updateDatasourcePluginJsonDataOption(props, 'UDPConnectionLimit', val);
  };

  const onDNSLookupKDCChanged = (event: SyntheticEvent<HTMLInputElement>) => {
    updateDatasourcePluginJsonDataOption(props, 'enableDNSLookupKDC', event.currentTarget.value);
  };

  const onKrbConfigChanged = (event: SyntheticEvent<HTMLInputElement>) => {
    updateDatasourcePluginJsonDataOption(props, 'configFilePath', event.currentTarget.value);
  };

  return (
    <>
      <ConfigSubSection title="Windows AD: Advanced Settings">
        <FieldSet>
          <Field
            label="UDP Preference Limit"
            description={
              <span>
                The default is <code>1</code> and means always use TCP and is optional.
              </span>
            }
          >
            <Input
              type="text"
              width={LONG_WIDTH}
              placeholder="0"
              defaultValue={jsonData.UDPConnectionLimit}
              onChange={(e) => {
                const val = Number(e.currentTarget.value);
                if (!Number.isNaN(val)) {
                  onUDPLimitChanged(val);
                }
              }}
            />
          </Field>
          <Field
            label="DNS Lookup KDC"
            description={
              <span>
                Indicate whether DNS `SRV` records should be used to locate the KDCs and other servers for a realm. The
                default is <code>true</code>.
              </span>
            }
          >
            <Input
              type="text"
              width={LONG_WIDTH}
              placeholder="true"
              defaultValue={jsonData.enableDNSLookupKDC}
              onChange={onDNSLookupKDCChanged}
            />
          </Field>
          <Field
            label="krb5 config file path"
            description={
              <span>
                The path to the configuration file for the{' '}
                <a href="https://web.mit.edu/kerberos/krb5-1.12/doc/admin/conf_files/krb5_conf.html">
                  MIT krb5 package
                </a>
                . The default is <code>/etc/krb5.conf</code>.
              </span>
            }
          >
            <Input
              onChange={onKrbConfigChanged}
              width={LONG_WIDTH}
              required
              value={configFilePath || '/etc/krb5.conf'}
            />
          </Field>
        </FieldSet>
      </ConfigSubSection>
    </>
  );
};
