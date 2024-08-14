import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { connect } from 'react-redux';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { useStyles2, Alert, Box, Button, Field, Input, Stack, Text, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import config from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';
import { Loader } from 'app/features/plugins/admin/components/Loader';
import { GroupMapping, LdapAttributes, LdapPayload, LdapSettings, StoreState } from 'app/types';

import { LdapDrawer } from './LdapDrawer';

const mapStateToProps = (state: StoreState) => ({
  ldapSsoSettings: state.ldap.ldapSsoSettings,
});

const mapDispatchToProps = {};

const connector = connect(mapStateToProps, mapDispatchToProps);

interface FormModel {
  serverHost: string;
  bindDn: string;
  bindPassword: string;
  searchFilter: string;
  searchBaseDns: string;
}

const pageNav: NavModelItem = {
  text: 'LDAP',
  icon: 'shield',
  id: 'LDAP',
};

const emptySettings: LdapPayload = {
  id: '',
  provider: '',
  source: '',
  settings: {
    activeSyncEnabled: false,
    allowSignUp: false,
    config: {
      server: {
        attributes: {},
        bindDn: '',
        bindPassword: '',
        clientCert: '',
        clientKey: '',
        groupMappings: [],
        groupSearchBaseDns: [],
        groupSearchFilter: '',
        groupSearchFilterUserAttribute: '',
        host: '',
        minTlsVersion: '',
        port: 389,
        rootCaCert: '',
        searchBaseDn: [],
        searchFilter: '',
        skipOrgRoleSync: false,
        sslSkipVerify: false,
        startTls: false,
        timeout: 10,
        tlsCiphers: [],
        tlsSkipVerify: false,
        useSsl: false,
      },
    },
    enabled: false,
    skipOrgRoleSync: false,
    syncCron: '',
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapJsonToModel = (json: any): LdapPayload => {
  const settings = json.settings;
  const config = settings.config;
  const server = config.servers[0];
  const attributes: LdapAttributes = {
    email: server.attributes.email,
    memberOf: server.attributes.member_of,
    name: server.attributes.name,
    surname: server.attributes.surname,
    username: server.attributes.username,
  };
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const groupMappings: GroupMapping[] = server.group_mappings.map((gp: any) => ({
    grafanaAdmin: !!gp.grafana_admin,
    groupDn: gp.group_dn,
    orgId: +gp.org_id,
    orgRole: gp.org_role,
  }));
  return {
    id: json.id,
    provider: json.provider,
    source: json.source,
    settings: {
      activeSyncEnabled: settings.activeSyncEnabled,
      allowSignUp: settings.allowSignUp,
      config: {
        server: {
          attributes: attributes,
          bindDn: server.bind_dn,
          bindPassword: server.bind_password,
          clientCert: server.client_cert,
          clientKey: server.client_key,
          groupMappings: groupMappings,
          groupSearchBaseDns: server.group_search_base_dns,
          groupSearchFilter: server.group_search_filter,
          groupSearchFilterUserAttribute: server.group_search_filter_user_attribute,
          host: server.host,
          minTlsVersion: server.min_tls_version,
          port: +server.port,
          rootCaCert: server.root_ca_cert,
          searchBaseDn: server.search_base_dns,
          searchFilter: server.search_filter,
          skipOrgRoleSync: !!server.map_ldap_groups_to_org_roles,
          sslSkipVerify: server.ssl_skip_verify,
          startTls: server.start_tls,
          timeout: +server.timeout,
          tlsCiphers: server.tls_ciphers,
          tlsSkipVerify: server.tls_skip_verify,
          useSsl: server.use_ssl,
        },
      },
      enabled: settings.enabled,
      skipOrgRoleSync: settings.skipOrgRoleSync,
      syncCron: settings.syncCron,
    },
  };
};

export const LdapSettingsPage = (): JSX.Element => {
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formSettings, setFormSettings] = useState<LdapPayload>(emptySettings);
  const { register, handleSubmit } = useForm<FormModel>();
  const styles = useStyles2(getStyles);

  useEffect(() => {
    async function init() {
      const payload = await getBackendSrv().get<LdapPayload>('/api/v1/sso-settings/ldap');
      if (!payload) {
        console.error('Error fetching LDAP settings'); // TODO: add error handling
        return;
      }

      if (!payload.settings || !payload.settings.config) {
        setIsLoading(false);
        return;
      }
      setFormSettings(mapJsonToModel(payload));
      setIsLoading(false);
    }
    init();
  }, []);

  // Display warning if the feature flag is disabled
  if (!config.featureToggles.ssoSettingsLDAP) {
    return (
      <Alert title="invalid configuration">
        <Trans i18nKey="ldap-settings-page.alert">
          This page is only accessible by enabling the <strong>ssoSettingsLDAP</strong> feature flag.
        </Trans>
      </Alert>
    );
  }

  const submitLdapSettings = ({}: FormModel) => {
    console.log('submitLdapSettings', formSettings);
  };

  // Button's Actions
  const saveForm = async () => {
    const payload = {
      id: formSettings.id,
      provider: formSettings.provider,
      source: formSettings.source,
      settings: {
        active_sync_enabled: formSettings.settings.activeSyncEnabled,
        allow_sign_up: formSettings.settings.allowSignUp,
        config: {
          servers: [
            {
              attributes: {
                email: formSettings.settings.config.server.attributes.email,
                member_of: formSettings.settings.config.server.attributes.memberOf,
                name: formSettings.settings.config.server.attributes.name,
                surname: formSettings.settings.config.server.attributes.surname,
                username: formSettings.settings.config.server.attributes.username,
              },
              bind_dn: formSettings.settings.config.server.bindDn,
              bind_password: formSettings.settings.config.server.bindPassword,
              client_cert: formSettings.settings.config.server.clientCert,
              client_key: formSettings.settings.config.server.clientKey,
              group_mappings: formSettings.settings.config.server.groupMappings.map((gp: GroupMapping) => ({
                grafana_admin: gp.grafanaAdmin,
                group_dn: gp.groupDn,
                org_id: gp.orgId,
                org_role: gp.orgRole,
              })),
              group_search_base_dns: formSettings.settings.config.server.groupSearchBaseDns,
              group_search_filter: formSettings.settings.config.server.groupSearchFilter,
              group_search_filter_user_attribute: formSettings.settings.config.server.groupSearchFilterUserAttribute,
              host: formSettings.settings.config.server.host,
              min_tls_version: formSettings.settings.config.server.minTlsVersion,
              port: formSettings.settings.config.server.port,
              root_ca_cert: formSettings.settings.config.server.rootCaCert,
              search_base_dns: formSettings.settings.config.server.searchBaseDn,
              search_filter: formSettings.settings.config.server.searchFilter,
              skip_org_role_sync: formSettings.settings.config.server.skipOrgRoleSync,
              ssl_skip_verify: formSettings.settings.config.server.sslSkipVerify,
              start_tls: formSettings.settings.config.server.startTls,
              timeout: formSettings.settings.config.server.timeout,
              tls_ciphers: formSettings.settings.config.server.tlsCiphers,
              tls_skip_verify: formSettings.settings.config.server.tlsSkipVerify,
              use_ssl: formSettings.settings.config.server.useSsl,
            },
          ],
        },
        enabled: formSettings.settings.enabled,
        skip_org_role_sync: formSettings.settings.skipOrgRoleSync,
        sync_cron: formSettings.settings.syncCron,
      },
    };
    try {
      const result = await getBackendSrv().put('/api/v1/sso-settings/ldap', payload);
      if (result) {
        console.error('Error saving LDAP settings');
      }
      // TODO: add success message
    } catch (error) {
      console.error('Error saving LDAP settings', error);
    }
  };
  const discardForm = async () => {
    try {
      setIsLoading(true);
      await getBackendSrv().delete('/api/v1/sso-settings/ldap');
      const payload = await getBackendSrv().get<LdapPayload>('/api/v1/sso-settings/ldap');
      if (!payload) {
        console.error('Error fetching LDAP settings');
        return;
      }

      if (!payload.settings || !payload.settings.config) {
        setIsLoading(false);
        return;
      }
      setFormSettings(mapJsonToModel(payload));
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };
  const onChange = (ldapSettings: LdapSettings) => {
    setFormSettings({
      ...formSettings,
      settings: {
        ...formSettings.settings,
        ...ldapSettings,
      },
    });
  };

  const documentation = (
    <TextLink
      href="https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/ldap/"
      external
    >
      <Trans i18nKey="ldap-settings-page.documentation">documentation</Trans>
    </TextLink>
  );
  const subTitle = (
    <Trans i18nKey="ldap-settings-page.subtitle">
      The LDAP integration in Grafana allows your Grafana users to log in with their LDAP credentials. Find out more in
      our {documentation}.
    </Trans>
  );

  return (
    <Page navId="authentication" pageNav={pageNav} subTitle={subTitle}>
      <Page.Contents>
        {isLoading && <Loader />}
        {!isLoading && formSettings && (
          <section className={styles.form}>
            <h3>
              <Trans i18nKey="ldap-settings-page.title">Basic Settings</Trans>
            </h3>
            <form onSubmit={handleSubmit(submitLdapSettings)}>
              <Field
                htmlFor="host"
                label={t('ldap-settings-page.host.label', 'Server host')}
                description={t(
                  'ldap-settings-page.host.description',
                  'Hostname or IP address of the LDAP server you wish to connect to.'
                )}
              >
                <Input
                  id="host"
                  placeholder={t('ldap-settings-page.host.placeholder', 'example: 127.0.0.1')}
                  type="text"
                  defaultValue={formSettings.settings?.config?.server?.host}
                  onChange={({ currentTarget: { value } }) =>
                    onChange({
                      ...formSettings.settings,
                      config: {
                        ...formSettings.settings.config,
                        server: {
                          ...formSettings.settings.config.server,
                          host: value,
                        },
                      },
                    })
                  }
                />
              </Field>
              <Field
                htmlFor="bind-dn"
                label={t('ldap-settings-page.bind-dn.label', 'Bind DN')}
                description={t(
                  'ldap-settings-page.bind-dn.description',
                  'Distinguished name of the account used to bind and authenticate to the LDAP server.'
                )}
              >
                <Input
                  {...register('bindDn', { required: false })}
                  id="bind-dn"
                  placeholder={t('ldap-settings-page.bind-dn.placeholder', 'example: cn=admin,dc=grafana,dc=org')}
                  type="text"
                  value={formSettings.settings.config.server.bindDn}
                />
              </Field>
              <Field htmlFor="bind-password" label={t('ldap-settings-page.bind-password.label', 'Bind password')}>
                <Input
                  {...register('bindPassword', { required: false })}
                  id="bind-password"
                  type="text"
                  value={formSettings.settings.config.server.bindPassword}
                />
              </Field>
              <Field
                htmlFor="search-filter"
                label={t('ldap-settings-page.search-filter.label', 'Search filter*')}
                description={t(
                  'ldap-settings-page.search-filter.description',
                  'LDAP search filter used to locate specific entries within the directory.'
                )}
              >
                <Input
                  {...register('searchFilter', { required: true })}
                  id="search-filter"
                  placeholder={t('ldap-settings-page.search-filter.placeholder', 'example: cn=%s')}
                  type="text"
                  value={formSettings.settings.config.server.searchFilter}
                />
              </Field>
              <Field
                htmlFor="search-base-dns"
                label={t('ldap-settings-page.search-base-dns.label', 'Search base DNS *')}
                description={t(
                  'ldap-settings-page.search-base-dns.description',
                  'An array of base dns to search through; separate by commas or spaces.'
                )}
              >
                <Input
                  {...register('searchBaseDns', { required: true })}
                  id="search-base-dns"
                  placeholder={t('ldap-settings-page.search-base-dns.placeholder', 'example: "dc=grafana.dc=org"')}
                  type="text"
                  value={formSettings.settings.config.server.searchBaseDn}
                />
              </Field>
              <Box borderColor="strong" borderStyle="solid" padding={2} width={68}>
                <Stack alignItems={'center'} direction={'row'} gap={2} justifyContent={'space-between'}>
                  <Stack alignItems={'start'} direction={'column'}>
                    <Text element="h2">
                      <Trans i18nKey="ldap-settings-page.advanced-settings-section.title">Advanced Settings</Trans>
                    </Text>
                    <Text>
                      <Trans i18nKey="ldap-settings-page.advanced-settings-section.subtitle">
                        Mappings, extra security measures, and more.
                      </Trans>
                    </Text>
                  </Stack>
                  <Button variant="secondary" onClick={() => setIsDrawerOpen(true)}>
                    <Trans i18nKey="ldap-settings-page.advanced-settings-section.edit.button">Edit</Trans>
                  </Button>
                </Stack>
              </Box>
              <Box display={'flex'} gap={2} marginTop={5}>
                <Stack alignItems={'center'} gap={2}>
                  <Button type={'submit'}>
                    <Trans i18nKey="ldap-settings-page.buttons-section.save-and-enable.button">Save and enable</Trans>
                  </Button>
                  <Button variant="secondary" onClick={saveForm}>
                    <Trans i18nKey="ldap-settings-page.buttons-section.save.button">Save</Trans>
                  </Button>
                  <Button variant="secondary" onClick={discardForm}>
                    <Trans i18nKey="ldap-settings-page.buttons-section.discard.button">Discard</Trans>
                  </Button>
                </Stack>
              </Box>
            </form>
          </section>
        )}
        {isDrawerOpen && (
          <LdapDrawer ldapSettings={formSettings.settings} onChange={onChange} onClose={() => setIsDrawerOpen(false)} />
        )}
      </Page.Contents>
    </Page>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    box: css({
      marginTop: theme.spacing(5),
      padding: theme.spacing(2),
      width: theme.spacing(68),
    }),
    disabledSection: css({
      padding: theme.spacing(2),
    }),
    form: css({
      input: css({
        width: theme.spacing(68),
      }),
    }),
  };
}

export default connector(LdapSettingsPage);
