import { css } from '@emotion/css';
import { Dispatch, SetStateAction, useEffect, useId, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  useStyles2,
  Button,
  CollapsableSection,
  Divider,
  Drawer,
  Field,
  Icon,
  Input,
  Label,
  MultiSelect,
  Select,
  Stack,
  Switch,
  TextLink,
  Tooltip,
  RadioButtonGroup,
  SecretInput,
} from '@grafana/ui';
import { MapKeyCertConfigured, LdapPayload } from 'app/types/ldap';

import { GroupMappingComponent } from './LdapGroupMapping';

interface Props {
  onClose: () => void;
  mapKeyCertConfigured: MapKeyCertConfigured;
  setMapKeyCertConfigured: Dispatch<SetStateAction<MapKeyCertConfigured>>;
}

const serverConfig = 'settings.config.servers.0';
const tlsOptions: Array<SelectableValue<string>> = ['TLS1.2', 'TLS1.3'].map((v) => ({ label: v, value: v }));
enum EncryptionProvider {
  Base64 = 'base64',
  FilePath = 'path',
}

export const LdapDrawerComponent = ({
  onClose,
  mapKeyCertConfigured: mapCertConfigured,
  setMapKeyCertConfigured: setMapCertConfigured,
}: Props) => {
  const [encryptionProvider, setEncryptionProvider] = useState(EncryptionProvider.Base64);

  const styles = useStyles2(getStyles);
  const { control, getValues, register, setValue, watch } = useFormContext<LdapPayload>();

  const nameId = useId();
  const surnameId = useId();
  const usernameId = useId();
  const memberOfId = useId();
  const emailId = useId();

  useEffect(() => {
    const { client_cert, client_key, root_ca_cert } = getValues(serverConfig);
    setEncryptionProvider(
      !client_cert?.length && !client_key?.length && !root_ca_cert?.length
        ? EncryptionProvider.Base64
        : EncryptionProvider.FilePath
    );
  }, [getValues]);

  const renderMultiSelectLabel = (value: string) => {
    if (value.length >= 5) {
      return `${value.slice(0, 2)}...${value.slice(-2)}`;
    }
    return value;
  };

  const attributesLabel = (
    <Label
      className={styles.sectionLabel}
      description={t(
        'ldap-drawer.attributes-section.description',
        "Specify the LDAP attributes that map to the user's given name, surname, and email address, ensuring the application correctly retrieves and displays user information."
      )}
    >
      <Trans i18nKey="ldap-drawer.attributes-section.label">Attributes</Trans>
    </Label>
  );

  const groupMappingsLabel = (
    <Label
      className={styles.sectionLabel}
      description={t('ldap-drawer.group-mapping-section.description', 'Map LDAP groups to Grafana org roles')}
    >
      <Trans i18nKey="ldap-drawer.group-mapping-section.label">Group mapping</Trans>
    </Label>
  );

  const useTlsDescription = (
    <>
      <Trans i18nKey="ldap-drawer.extra-security-section.use-ssl-tooltip">
        For a complete list of supported ciphers and TLS versions, refer to:
      </Trans>{' '}
      {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
      <TextLink style={{ fontSize: 'inherit' }} href="https://go.dev/src/crypto/tls/cipher_suites.go" external>
        https://go.dev/src/crypto/tls/cipher_suites.go
      </TextLink>
    </>
  );

  const onAddGroupMapping = () => {
    const groupMappings = getValues(`${serverConfig}.group_mappings`) || [];
    setValue(`${serverConfig}.group_mappings`, [
      ...groupMappings,
      {
        group_dn: '',
        org_id: 1,
        org_role: 'Viewer',
        grafana_admin: false,
      },
    ]);
  };

  const onRemoveGroupMapping = (index: number) => {
    const groupMappings = getValues(`${serverConfig}.group_mappings`);
    setValue(`${serverConfig}.group_mappings`, [...groupMappings.slice(0, index), ...groupMappings.slice(index + 1)]);
  };

  return (
    <Drawer title={t('ldap-drawer.title', 'Advanced settings')} onClose={onClose}>
      <CollapsableSection label={t('ldap-drawer.misc-section.label', 'Misc')} isOpen={true}>
        <Field
          label={t('ldap-drawer.misc-section.allow-sign-up-label', 'Allow sign-up')}
          description={t(
            'ldap-drawer.misc-section.allow-sign-up-descrition',
            'If not enabled, only existing Grafana users can log in using LDAP'
          )}
        >
          <Switch id="allow-sign-up" {...register('settings.allowSignUp')} />
        </Field>
        <Field
          label={t('ldap-drawer.misc-section.port-label', 'Port')}
          description={t(
            'ldap-drawer.misc-section.port-description',
            'Default port is 389 without SSL or 636 with SSL'
          )}
        >
          <Input
            id="port"
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="389"
            type="number"
            {...register(`${serverConfig}.port`, { valueAsNumber: true })}
          />
        </Field>
        <Field
          label={t('ldap-drawer.misc-section.timeout-label', 'Timeout')}
          description={t(
            'ldap-drawer.misc-section.timeout-description',
            'Timeout in seconds for the connection to the LDAP server'
          )}
        >
          <Input
            id="timeout"
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="10"
            type="number"
            {...register(`${serverConfig}.timeout`, { valueAsNumber: true })}
          />
        </Field>
      </CollapsableSection>
      <CollapsableSection label={attributesLabel} isOpen={true}>
        <Field label={t('ldap-drawer.attributes-section.name-label', 'Name')}>
          <Input id={nameId} {...register(`${serverConfig}.attributes.name`)} />
        </Field>
        <Field label={t('ldap-drawer.attributes-section.surname-label', 'Surname')}>
          <Input id={surnameId} {...register(`${serverConfig}.attributes.surname`)} />
        </Field>
        <Field label={t('ldap-drawer.attributes-section.username-label', 'Username')}>
          <Input id={usernameId} {...register(`${serverConfig}.attributes.username`)} />
        </Field>
        <Field label={t('ldap-drawer.attributes-section.member-of-label', 'Member Of')}>
          <Input id={memberOfId} {...register(`${serverConfig}.attributes.member_of`)} />
        </Field>
        <Field label={t('ldap-drawer.attributes-section.email-label', 'Email')}>
          <Input id={emailId} {...register(`${serverConfig}.attributes.email`)} />
        </Field>
      </CollapsableSection>
      <CollapsableSection label={groupMappingsLabel} isOpen={true}>
        <Field
          htmlFor="skip-org-role-sync"
          label={t('ldap-drawer.group-mapping-section.skip-org-role-sync-label', 'Skip organization role sync')}
          description={t(
            'ldap-drawer.group-mapping-section.skip-org-role-sync-description',
            'Prevent synchronizing users’ organization roles from your IdP'
          )}
        >
          <Switch id="skip-org-role-sync" {...register(`${serverConfig}.skip_org_role_sync`)} />
        </Field>
        <Field
          htmlFor="group-search-filter"
          label={t('ldap-drawer.group-mapping-section.group-search-filter-label', 'Group search filter')}
          description={t(
            'ldap-drawer.group-mapping-section.group-search-filter-description',
            'Used to filter and identify group entries within the directory'
          )}
        >
          <Input id="group-search-filter" {...register(`${serverConfig}.group_search_filter`)} />
        </Field>
        <Field label={t('ldap-drawer.group-mapping-section.group-search-base-dns-label', 'Group search base DNS')}>
          <Controller
            name={`${serverConfig}.group_search_base_dns`}
            control={control}
            render={({ field: { onChange, ref, value, ...field } }) => (
              <MultiSelect
                {...field}
                allowCustomValue
                className={styles.multiSelect}
                noOptionsMessage=""
                placeholder={t(
                  'ldap-drawer.group-mapping-section.group-search-base-dns-placeholder',
                  'example: ou=groups,dc=example,dc=com'
                )}
                onChange={(v) => onChange(v.map(({ value }) => String(value)))}
                value={value?.map((v) => ({ label: v, value: v }))}
              />
            )}
          />
        </Field>
        <Field
          htmlFor="group-search-filter-user-attribute"
          label={t(
            'ldap-drawer.group-mapping-section.group-search-filter-user-attribute-label',
            'Group name attribute'
          )}
          description={t(
            'ldap-drawer.group-mapping-section.group-search-filter-user-attribute-description',
            'Identifies users within group entries for filtering purposes'
          )}
        >
          <Input
            id="group-search-filter-user-attribute"
            {...register(`${serverConfig}.group_search_filter_user_attribute`)}
          />
        </Field>
        {watch('settings.config.servers.0.group_mappings')?.map((_, i) => {
          return <GroupMappingComponent key={i} groupMappingIndex={i} onRemove={() => onRemoveGroupMapping(i)} />;
        })}
        <Divider />
        <Button className={styles.button} variant="secondary" icon="plus" onClick={() => onAddGroupMapping()}>
          <Trans i18nKey="ldap-drawer.group-mapping-section.add.button">Add group mapping</Trans>
        </Button>
      </CollapsableSection>
      <CollapsableSection
        label={t('ldap-drawer.extra-security-section.label', 'Extra security measures')}
        isOpen={true}
      >
        <Field
          label={t('ldap-drawer.extra-security-section.use-ssl-label', 'Use SSL')}
          description={t(
            'ldap-drawer.extra-security-section.use-ssl-description',
            'Set to true if LDAP server should use TLS connection (either with STARTTLS or LDAPS)'
          )}
        >
          <Stack>
            <Switch id="use-ssl" {...register(`${serverConfig}.use_ssl`)} />
            <Tooltip content={useTlsDescription} interactive>
              <Icon name="info-circle" />
            </Tooltip>
          </Stack>
        </Field>
        {watch(`${serverConfig}.use_ssl`) && (
          <>
            <Field
              label={t('ldap-drawer.extra-security-section.start-tls-label', 'Start TLS')}
              description={t(
                'ldap-drawer.extra-security-section.start-tls-description',
                'If set to true, use LDAP with STARTTLS instead of LDAPS'
              )}
            >
              <Switch id="start-tls" {...register(`${serverConfig}.start_tls`)} />
            </Field>
            <Field
              htmlFor="min-tls-version"
              label={t('ldap-drawer.extra-security-section.min-tls-version-label', 'Min TLS version')}
              description={t(
                'ldap-drawer.extra-security-section.min-tls-version-description',
                'This is the minimum TLS version allowed. Accepted values are: TLS1.2, TLS1.3.'
              )}
            >
              <Select
                id="min-tls-version"
                options={tlsOptions}
                value={watch(`${serverConfig}.min_tls_version`)}
                onChange={({ value }) => setValue(`${serverConfig}.min_tls_version`, value)}
              />
            </Field>
            <Field label={t('ldap-drawer.extra-security-section.tls-ciphers-label', 'TLS ciphers')}>
              <Controller
                name={`${serverConfig}.tls_ciphers`}
                control={control}
                render={({ field: { onChange, ref, value, ...field } }) => (
                  <MultiSelect
                    {...field}
                    allowCustomValue
                    className={styles.multiSelect}
                    noOptionsMessage=""
                    placeholder={t(
                      'ldap-drawer.extra-security-section.tls-ciphers-placeholder',
                      'example: TLS_AES_256_GCM_SHA384'
                    )}
                    onChange={(v) => onChange(v.map(({ value }) => String(value)))}
                    value={value?.map((v) => ({ label: v, value: v }))}
                  />
                )}
              />
            </Field>
            <Field
              label={t(
                'ldap-drawer.extra-security-section.encryption-provider-label',
                'Encryption key and certificate provision specification.'
              )}
              description={t(
                'ldap-drawer.extra-security-section.encryption-provider-description',
                'X.509 certificate provides the public part, while the private key issued in a PKCS#8 format provides the private part of the asymmetric encryption.'
              )}
            >
              <RadioButtonGroup
                id="encryption-provider"
                options={[
                  {
                    label: t(
                      'ldap-drawer.extra-security-section.encryption-provider-base-64',
                      'Base64-encoded content'
                    ),
                    value: EncryptionProvider.Base64,
                  },
                  {
                    label: t('ldap-drawer.extra-security-section.encryption-provider-file-path', 'Path to files'),
                    value: EncryptionProvider.FilePath,
                  },
                ]}
                value={encryptionProvider}
                onChange={setEncryptionProvider}
              />
            </Field>
            {encryptionProvider === EncryptionProvider.Base64 && (
              <>
                <Field
                  label={t(
                    'ldap-drawer.extra-security-section.root-ca-cert-value-label',
                    'Root CA certificate content'
                  )}
                >
                  <Controller
                    name={`${serverConfig}.root_ca_cert_value`}
                    control={control}
                    render={({ field: { onChange, ref, value, ...field } }) => (
                      <MultiSelect
                        {...field}
                        allowCustomValue
                        className={styles.multiSelect}
                        noOptionsMessage=""
                        placeholder={t(
                          'ldap-drawer.extra-security-section.root-ca-cert-value-placeholder',
                          'example: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t'
                        )}
                        onChange={(v) => onChange(v.map(({ value }) => String(value)))}
                        value={value?.map((v) => ({ label: renderMultiSelectLabel(v), value: v }))}
                      />
                    )}
                  />
                </Field>
                <Field
                  label={t('ldap-drawer.extra-security-section.client-cert-value-label', 'Client certificate content')}
                >
                  <Input
                    id="client-cert"
                    placeholder={t(
                      'ldap-drawer.extra-security-section.client-cert-value-placeholder',
                      'Client certificate content in base64'
                    )}
                    type="text"
                    {...register(`${serverConfig}.client_cert_value`)}
                  />
                </Field>
                <Field label={t('ldap-drawer.extra-security-section.client-key-value-label', 'Client key content')}>
                  <SecretInput
                    id="client-key"
                    placeholder={t(
                      'ldap-drawer.extra-security-section.client-key-value-placeholder',
                      'Client key content in base64'
                    )}
                    isConfigured={mapCertConfigured.clientKeyCertValue}
                    onReset={() => {
                      setValue(`${serverConfig}.client_key_value`, '');
                      setMapCertConfigured({ ...mapCertConfigured, clientKeyCertValue: false });
                    }}
                  />
                </Field>
              </>
            )}
            {encryptionProvider === EncryptionProvider.FilePath && (
              <>
                <Field label={t('ldap-drawer.extra-security-section.root-ca-cert-label', 'Root CA certificate path')}>
                  <Input
                    id="root-ca-cert"
                    placeholder={t(
                      'ldap-drawer.extra-security-section.root-ca-cert-placeholder',
                      '/path/to/root_ca_cert.pem'
                    )}
                    type="text"
                    {...register(`${serverConfig}.root_ca_cert`)}
                  />
                </Field>
                <Field label={t('ldap-drawer.extra-security-section.client-cert-label', 'Client certificate path')}>
                  <Input
                    id="client-cert"
                    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                    placeholder="/path/to/client_cert.pem"
                    type="text"
                    {...register(`${serverConfig}.client_cert`)}
                  />
                </Field>
                <Field label={t('ldap-drawer.extra-security-section.client-key-label', 'Client key path')}>
                  <SecretInput
                    id="client-key"
                    placeholder={t(
                      'ldap-drawer.extra-security-section.client-key-placeholder',
                      '/path/to/client_key.pem'
                    )}
                    isConfigured={mapCertConfigured.clientKeyCertPath}
                    onReset={() => {
                      setValue(`${serverConfig}.client_key`, '');
                      setMapCertConfigured({ ...mapCertConfigured, clientKeyCertPath: false });
                    }}
                    value={watch(`${serverConfig}.client_key`)}
                    onChange={({ currentTarget: { value } }) => setValue(`${serverConfig}.client_key`, value)}
                  />
                </Field>
              </>
            )}
          </>
        )}
      </CollapsableSection>
    </Drawer>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    sectionLabel: css({
      fontSize: theme.typography.size.lg,
    }),
    button: css({
      marginBottom: theme.spacing(4),
    }),
    multiSelect: css({
      'div:last-of-type > svg': {
        display: 'none',
      },
    }),
  };
}
