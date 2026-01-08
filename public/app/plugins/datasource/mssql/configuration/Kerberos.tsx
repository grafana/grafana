import { SyntheticEvent } from 'react';

import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ConfigSubSection } from '@grafana/plugin-ui';
import { FieldSet, Input, Field, TextLink } from '@grafana/ui';

import { MSSQLAuthenticationType, MssqlOptions } from '../types';

export const UsernameMessage = (
  <span>
    <Trans i18nKey="configuration.kerberos.username-message">
      Use the format <code>user@EXAMPLE.COM</code>. Realm is derived from the username.
    </Trans>
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
        <FieldSet label={t('configuration.kerberos-config.label-keytab', 'Windows AD: Keytab')}>
          <Field
            label={t('configuration.kerberos-config.label-username', 'Username')}
            required
            invalid={!settings.user}
            error={t('configuration.kerberos-config.required-username', 'Username is required')}
            description={UsernameMessage}
          >
            <Input
              value={settings.user || ''}
              placeholder={t('configuration.kerberos-config.placeholder-username', 'name@EXAMPLE.COM')}
              onChange={(e) => onOptionsChange({ ...settings, ...{ ['user']: e.currentTarget.value } })}
              width={LONG_WIDTH}
            />
          </Field>
          <Field
            label={t('configuration.kerberos-config.label-keytab-file-path', 'Keytab file path')}
            required
            invalid={!keytabFilePath}
            error={'Keytab file path is required'}
          >
            <Input
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
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
        <FieldSet label={t('configuration.kerberos-config.label-credential-cache', 'Windows AD: Credential cache')}>
          <Field
            label={t('configuration.kerberos-config.label-credential-cache-path', 'Credential cache path')}
            required
            invalid={!credentialCache}
            error={t(
              'configuration.kerberos-config.required-credential-cache-path',
              'Credential cache path is required'
            )}
          >
            <Input
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
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
        <FieldSet
          label={t('configuration.kerberos-config.label-credential-cache-file', 'Windows AD: Credential cache file')}
        >
          <Field
            label={t('configuration.kerberos-config.label-username', 'Username')}
            required
            invalid={!settings.user}
            error={t('configuration.kerberos-config.required-username', 'Username is required')}
            description={UsernameMessage}
          >
            <Input
              value={settings.user || ''}
              placeholder={t('configuration.kerberos-config.placeholder-username', 'name@EXAMPLE.COM')}
              onChange={(e) => onOptionsChange({ ...settings, ...{ ['user']: e.currentTarget.value } })}
              width={LONG_WIDTH}
            />
          </Field>
          <Field
            label={t('configuration.kerberos-config.label-credential-cache-file-path', 'Credential cache file path')}
            required
            invalid={!credentialCacheLookupFile}
            error={t(
              'configuration.kerberos-config.required-credential-cache-file-path',
              'Credential cache file path is required'
            )}
          >
            <Input
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
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
      <ConfigSubSection
        title={t('configuration.kerberos-advanced-settings.title-advanced-settings', 'Windows AD: Advanced Settings')}
      >
        <FieldSet>
          <Field
            label={t('configuration.kerberos-advanced-settings.label-udp-preference-limit', 'UDP Preference Limit')}
            // TODO
            description={
              <span>
                <Trans
                  i18nKey="configuration.kerberos-advanced-settings.description-udp-preference-limit"
                  values={{ default: '1' }}
                >
                  The default is <code>{'{{default}}'}</code> and means always use TCP and is optional.
                </Trans>
              </span>
            }
          >
            <Input
              type="text"
              width={LONG_WIDTH}
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
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
            label={t('configuration.kerberos-advanced-settings.label-dns-lookup-kdc', 'DNS Lookup KDC')}
            description={
              <span>
                <Trans
                  i18nKey="configuration.kerberos-advanced-settings.description-dns-lookup-kdc"
                  values={{ default: 'true' }}
                >
                  Indicate whether DNS `SRV` records should be used to locate the KDCs and other servers for a realm.
                  The default is <code>{'{{default}}'}</code>.
                </Trans>
              </span>
            }
          >
            <Input
              type="text"
              width={LONG_WIDTH}
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              placeholder="true"
              defaultValue={jsonData.enableDNSLookupKDC}
              onChange={onDNSLookupKDCChanged}
            />
          </Field>
          <Field
            label={t('configuration.kerberos-advanced-settings.label-krb5-config-file-path', 'krb5 config file path')}
            description={
              <span>
                <Trans
                  i18nKey="configuration.kerberos-advanced-settings.description-krb5-config-file-path"
                  values={{ default: '/etc/krb5.conf' }}
                >
                  The path to the configuration file for the{' '}
                  <TextLink external href="https://web.mit.edu/kerberos/krb5-1.12/doc/admin/conf_files/krb5_conf.html">
                    MIT krb5 package
                  </TextLink>
                  . The default is <code>{'{{default}}'}</code>.
                </Trans>
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
