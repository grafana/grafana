import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { connect } from 'react-redux';

import { AppEvents, GrafanaTheme2, NavModelItem } from '@grafana/data';
import { getBackendSrv, getAppEvents, locationService, reportInteraction } from '@grafana/runtime';
import {
  useStyles2,
  Alert,
  Box,
  Button,
  Field,
  IconButton,
  Input,
  LinkButton,
  Menu,
  Stack,
  Text,
  TextLink,
  Dropdown,
  MultiSelect,
} from '@grafana/ui';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';
import { Page } from 'app/core/components/Page/Page';
import config from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';
import { Loader } from 'app/features/plugins/admin/components/Loader';
import { LdapPayload, MapKeyCertConfigured, StoreState } from 'app/types';

import { LdapDrawerComponent } from './LdapDrawer';

const appEvents = getAppEvents();

const mapStateToProps = (state: StoreState) => ({
  ldapSsoSettings: state.ldap.ldapSsoSettings,
});

const mapDispatchToProps = {};

const connector = connect(mapStateToProps, mapDispatchToProps);

const pageNav: NavModelItem = {
  text: 'LDAP',
  icon: 'shield',
  id: 'LDAP',
};

const serverConfig = 'settings.config.servers.0';

const isOptionDefined = (option: string | undefined) => option !== undefined && option !== '';

const emptySettings: LdapPayload = {
  id: '',
  provider: '',
  source: '',
  settings: {
    activeSyncEnabled: false,
    allowSignUp: false,
    config: {
      servers: [
        {
          attributes: {},
          bind_dn: '',
          bind_password: '',
          client_cert: '',
          client_cert_value: '',
          client_key: '',
          client_key_value: '',
          group_mappings: [],
          group_search_base_dns: [],
          group_search_filter: '',
          group_search_filter_user_attribute: '',
          host: '',
          min_tls_version: '',
          port: 389,
          root_ca_cert: '',
          root_ca_cert_value: [],
          search_base_dns: [],
          search_filter: '',
          skip_org_role_sync: false,
          ssl_skip_verify: false,
          start_tls: false,
          timeout: 10,
          tls_ciphers: [],
          tls_skip_verify: false,
          use_ssl: false,
        },
      ],
    },
    enabled: false,
    skipOrgRoleSync: false,
    syncCron: '',
  },
};

export const LdapSettingsPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [mapKeyCertConfigured, setMapKeyCertConfigured] = useState<MapKeyCertConfigured>({
    // values
    rootCaCertValue: false,
    clientCertValue: false,
    clientKeyCertValue: false,
    // paths
    rootCaCertPath: false,
    clientCertPath: false,
    clientKeyCertPath: false,
  });

  const methods = useForm<LdapPayload>({ defaultValues: emptySettings });
  const {
    control,
    formState: { isDirty },
    getValues,
    handleSubmit,
    register,
    reset,
    watch,
  } = methods;

  const styles = useStyles2(getStyles);

  useEffect(() => {
    async function init() {
      const payload = await getSettings();
      let serverConfig = emptySettings.settings.config.servers[0];
      if (payload.settings.config.servers?.length > 0) {
        serverConfig = payload.settings.config.servers[0];
      }
      setMapKeyCertConfigured({
        rootCaCertValue: serverConfig.root_ca_cert_value?.length > 0,
        clientCertValue: isOptionDefined(serverConfig.client_cert_value),
        clientKeyCertValue: isOptionDefined(serverConfig.client_key_value),
        rootCaCertPath: isOptionDefined(serverConfig.root_ca_cert),
        clientCertPath: isOptionDefined(serverConfig.client_cert),
        clientKeyCertPath: isOptionDefined(serverConfig.client_key),
      });

      reset(payload);
      setIsLoading(false);
    }
    init();
  }, [reset]);

  /**
   * Display warning if the feature flag is disabled
   */
  if (!config.featureToggles.ssoSettingsLDAP) {
    return (
      <Alert title="invalid configuration">
        <Trans i18nKey="ldap-settings-page.alert.feature-flag-disabled">
          This page is only accessible by enabling the <strong>ssoSettingsLDAP</strong> feature flag.
        </Trans>
      </Alert>
    );
  }

  /**
   * Fetches the settings from the backend
   * @returns Promise<LdapPayload>
   */
  const getSettings = async () => {
    try {
      const payload = await getBackendSrv().get<LdapPayload>('/api/v1/sso-settings/ldap');
      if (!payload || !payload.settings || !payload.settings.config) {
        appEvents.publish({
          type: AppEvents.alertError.name,
          payload: [t('ldap-settings-page.alert.error-fetching', 'Error fetching LDAP settings')],
        });
        return emptySettings;
      }
      return payload;
    } catch (error) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [t('ldap-settings-page.alert.error-fetching', 'Error fetching LDAP settings')],
      });
      return emptySettings;
    }
  };

  /**
   * Save payload to the backend
   * @param payload LdapPayload
   */
  const putPayload = async (payload: LdapPayload) => {
    try {
      const result = await getBackendSrv().put('/api/v1/sso-settings/ldap', payload);
      if (result) {
        appEvents.publish({
          type: AppEvents.alertError.name,
          payload: [t('ldap-settings-page.alert.error-saving', 'Error saving LDAP settings')],
        });
      }
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: [t('ldap-settings-page.alert.saved', 'LDAP settings saved')],
      });
      reset(await getSettings());

      // Delay redirect so the form state can update
      setTimeout(() => {
        locationService.push(`/admin/authentication`);
      }, 300);
    } catch (error) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [t('ldap-settings-page.alert.error-saving', 'Error saving LDAP settings')],
      });
    }
  };

  const onErrors = () => {
    appEvents.publish({
      type: AppEvents.alertError.name,
      payload: [t('ldap-settings-page.alert.error-validate-form', 'Error validating LDAP settings')],
    });
  };

  /**
   * Button's Actions
   */
  const submitAndEnableLdapSettings = async (payload: LdapPayload) => {
    payload.settings.enabled = !payload.settings.enabled;
    await putPayload(payload);
    reportInteraction('authentication_ldap_enabled');
  };
  const saveForm = async () => {
    await putPayload(getValues());
    reportInteraction('authentication_ldap_saved');
  };
  const deleteLDAPConfig = async () => {
    try {
      setIsLoading(true);
      await getBackendSrv().delete('/api/v1/sso-settings/ldap');
      const payload = await getSettings();
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: [t('ldap-settings-page.alert.discard-success', 'LDAP settings discarded')],
      });
      reset(payload);
      reportInteraction('authentication_ldap_deleted');

      setTimeout(() => {
        locationService.push(`/admin/authentication`);
      }, 300);
    } catch (error) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [t('ldap-settings-page.alert.error-saving', 'Error saving LDAP settings')],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onDiscard = () => {
    reportInteraction('authentication_ldap_abandoned');
  };

  const subTitle = (
    <Trans i18nKey="ldap-settings-page.subtitle">
      The LDAP integration in Grafana allows your Grafana users to log in with their LDAP credentials. Find out more in
      our{' '}
      <TextLink
        href="https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/ldap/"
        external
      >
        <Trans i18nKey="ldap-settings-page.documentation">documentation</Trans>
      </TextLink>
      .
    </Trans>
  );

  const disabledFormAlert = (
    <Alert title={t('ldap-settings-page.login-form-alert.title', 'Basic login disabled')}>
      <Trans i18nKey="ldap-settings-page.login-form-alert.description">
        Your LDAP configuration is not working because the basic login form is currently disabled. Please enable the
        login form to use LDAP authentication. You can enable it on the Authentication page under “Auth settings”.
      </Trans>
    </Alert>
  );

  return (
    <Page navId="authentication" pageNav={pageNav} subTitle={subTitle}>
      <Page.Contents>
        {config.disableLoginForm && disabledFormAlert}
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(submitAndEnableLdapSettings, onErrors)}>
            <FormPrompt confirmRedirect={isDirty} onDiscard={onDiscard} />
            {isLoading && <Loader />}
            {!isLoading && (
              <section className={styles.form}>
                <h3>
                  <Trans i18nKey="ldap-settings-page.title">Basic Settings</Trans>
                </h3>
                <Field
                  label={t('ldap-settings-page.host.label', 'Server host *')}
                  description={t(
                    'ldap-settings-page.host.description',
                    'Hostname or IP address of the LDAP server you wish to connect to.'
                  )}
                >
                  <Input
                    id="host"
                    placeholder={t('ldap-settings-page.host.placeholder', 'example: 127.0.0.1')}
                    type="text"
                    {...register(`${serverConfig}.host`, { required: true })}
                  />
                </Field>
                <Field
                  label={t('ldap-settings-page.bind-dn.label', 'Bind DN')}
                  description={t(
                    'ldap-settings-page.bind-dn.description',
                    'Distinguished name of the account used to bind and authenticate to the LDAP server.'
                  )}
                >
                  <Input
                    id="bind-dn"
                    placeholder={t('ldap-settings-page.bind-dn.placeholder', 'example: cn=admin,dc=grafana,dc=org')}
                    type="text"
                    {...register(`${serverConfig}.bind_dn`)}
                  />
                </Field>
                <Field label={t('ldap-settings-page.bind-password.label', 'Bind password')}>
                  <Input
                    id="bind-password"
                    type="text"
                    {...register(`${serverConfig}.bind_password`, { required: false })}
                  />
                </Field>
                <Field
                  label={t('ldap-settings-page.search_filter.label', 'Search filter *')}
                  description={t(
                    'ldap-settings-page.search_filter.description',
                    'LDAP search filter used to locate specific entries within the directory.'
                  )}
                >
                  <Input
                    id="search_filter"
                    placeholder={t('ldap-settings-page.search_filter.placeholder', 'example: cn=%s')}
                    type="text"
                    {...register(`${serverConfig}.search_filter`, { required: true })}
                  />
                </Field>
                <Field
                  label={t('ldap-settings-page.search-base-dns.label', 'Search base DNS *')}
                  description={t(
                    'ldap-settings-page.search-base-dns.description',
                    'An array of base dns to search through.'
                  )}
                >
                  <Controller
                    name={`${serverConfig}.search_base_dns`}
                    control={control}
                    render={({ field: { onChange, ref, ...field } }) => (
                      <MultiSelect
                        {...field}
                        allowCustomValue
                        className={styles.multiSelect}
                        noOptionsMessage=""
                        placeholder={t('ldap-settings-page.search-base-dns.placeholder', 'example: dc=grafana,dc=org')}
                        onChange={(v) => onChange(v.map(({ value }) => String(value)))}
                      />
                    )}
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
                      <Trans i18nKey="ldap-settings-page.advanced-settings-section.edit-button">Edit</Trans>
                    </Button>
                  </Stack>
                </Box>
                <Box display="flex" gap={2} marginTop={5}>
                  <Stack alignItems="center" gap={2}>
                    {!watch('settings.enabled') && (
                      <Button type="submit">
                        <Trans i18nKey="ldap-settings-page.buttons-section.save-and-enable-button">
                          Save and enable
                        </Trans>
                      </Button>
                    )}
                    {watch('settings.enabled') && (
                      <Button variant="secondary" type="submit">
                        <Trans i18nKey="ldap-settings-page.buttons-section.disable-button">Disable</Trans>
                      </Button>
                    )}
                    <Button variant="secondary" onClick={saveForm}>
                      <Trans i18nKey="ldap-settings-page.buttons-section.save-button">Save</Trans>
                    </Button>
                    <LinkButton href="/admin/authentication" variant="secondary">
                      <Trans i18nKey="ldap-settings-page.buttons-section.discard-button">Discard</Trans>
                    </LinkButton>
                    <Dropdown
                      overlay={
                        <Menu>
                          <Menu.Item label="Reset to default values" icon="history-alt" onClick={deleteLDAPConfig} />
                        </Menu>
                      }
                      placement="bottom-start"
                    >
                      <IconButton
                        tooltip="More actions"
                        title="More actions"
                        size="md"
                        variant="secondary"
                        name="ellipsis-v"
                        hidden={watch('source') === 'system'}
                      />
                    </Dropdown>
                  </Stack>
                </Box>
              </section>
            )}
            {isDrawerOpen && (
              <LdapDrawerComponent
                onClose={() => setIsDrawerOpen(false)}
                mapKeyCertConfigured={mapKeyCertConfigured}
                setMapKeyCertConfigured={setMapKeyCertConfigured}
              />
            )}
          </form>
        </FormProvider>
      </Page.Contents>
    </Page>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    form: css({
      width: theme.spacing(68),
    }),
    multiSelect: css({
      'div:last-of-type > svg': {
        display: 'none',
      },
    }),
  };
}

export default connector(LdapSettingsPage);
