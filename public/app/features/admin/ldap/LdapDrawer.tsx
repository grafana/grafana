import { css } from '@emotion/css';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  useStyles2,
  CollapsableSection,
  Divider,
  Drawer,
  Field,
  Icon,
  Input,
  Label,
  Select,
  Stack,
  Switch,
  Text,
  TextLink,
  Tooltip,
} from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { LdapPayload } from 'app/types';

interface Props {
  onClose: () => void;
}

const tlsOptions: Array<SelectableValue<string>> = ['TLS1.2', 'TLS1.3'].map((v) => ({ label: v, value: v }));

export const LdapDrawerComponent = ({ onClose }: Props) => {
  const styles = useStyles2(getStyles);
  const { register, setValue, watch } = useFormContext<LdapPayload>();
  // const onAddGroupMapping = () => {
  //   if (!ldapSettings.config.servers[0].group_mappings) {
  //     ldapSettings.config.servers[0].group_mappings = [];
  //   }
  //   ldapSettings.config.servers[0].group_mappings.push({
  //     group_dn: '',
  //     org_role: 'Viewer',
  //     org_id: 1,
  //     grafana_admin: false,
  //   });
  //   onChange({
  //     ...ldapSettings,
  //   });
  // };
  // const onServerConfigChange = (serverConfig: Partial<LdapServerConfig>) => {
  //   onChange({
  //     ...ldapSettings,
  //     config: {
  //       ...ldapSettings.config,
  //       servers: {
  //         ...ldapSettings.config.servers,
  //         ...serverConfig,
  //       },
  //     },
  //   });
  // };

  const groupMappingsLabel = <Label className={styles.sectionLabel} description={t('ldap-drawer.group-mapping-section.description', 'Map LDAP groups to Grafana org roles')}>
    <Trans i18nKey="ldap-drawer.group-mapping-section.label">Group mapping</Trans>
  </Label>

  const useSslDescriptionUrl = <TextLink href='https://go.dev/src/crypto/tls/cipher_suites.go' external>https://go.dev/src/crypto/tls/cipher_suites.go</TextLink>;
  const useSslDescription = <Trans i18nKey='ldap-drawer.extra-security-section.use-ssl.tooltip'>For a complete list of supported ciphers and TLS versions, refer to: {(useSslDescriptionUrl)}</Trans>;

  return (
    <Drawer title={t('ldap-drawer.title', 'Advanced Settings')} onClose={onClose}>
      <CollapsableSection label={t('ldap-drawer.misc-section.label', 'Misc')} isOpen={true}>
        <Field
          label={t('ldap-drawer.misc-section.allow-sign-up.label', 'Allow sign up')}
          description={t(
            'ldap-drawer.misc-section.allow-sign-up.descrition',
            'If not enabled, only existing Grafana users can log in using LDAP'
          )}
        >
          <Switch
            id="allow-sign-up"
            {...register('settings.allowSignUp')}
          />
        </Field>
        <Field
          label={t('ldap-drawer.misc-section.port.label', 'Port')}
          description={t(
            'ldap-drawer.misc-section.port.description',
            'Default port is 389 without SSL or 636 with SSL'
          )}
        >
          <Input
            id="port"
            placeholder={t('ldap-drawer.misc-section.port.placeholder', '389')}
            type="number"
            {...register(
              'settings.config.servers.0.port', { valueAsNumber: true })
            }
          />
        </Field>
        <Field
          label={t('ldap-drawer.misc-section.timeout.label', 'Timeout')}
          description={t(
            'ldap-drawer.misc-section.timeout.description',
            'Timeout in seconds for the connection to the LDAP server'
          )}
        >
          <Input
            id="timeout"
            placeholder={t('ldap-drawer.misc-section.timeout.placeholder', '389')}
            type="number"
            {...register(
              'settings.config.servers.0.timeout', { valueAsNumber: true })
            }
          />
        </Field>
      </CollapsableSection>
      <CollapsableSection label={t('ldap-drawer.attributes-section.label', 'Attributes')} isOpen={true}>
        <Text color="secondary">
          <Trans i18nKey="ldap-drawer.attributes-section.description">
            Specify the LDAP attributes that map to the user&lsquo;s given name, surname, and email address, ensuring
            the application correctly retrieves and displays user information.
          </Trans>
        </Text>
        <Field htmlFor="name" label={t('ldap-drawer.attributes-section.name.label', 'Name')}>
          <Input
            id="name"
            {...register('settings.config.servers.0.attributes.name')}
          />
        </Field>
        <Field htmlFor="surname" label={t('ldap-drawer.attributes-section.surname.label', 'Surname')}>
          <Input
            id="surname"
            {...register('settings.config.servers.0.attributes.surname')}
          />
        </Field>
        <Field htmlFor="username" label={t('ldap-drawer.attributes-section.username.label', 'Username')}>
          <Input
            id="username"
            {...register('settings.config.servers.0.attributes.username')}
          />
        </Field>
        <Field htmlFor="member-of" label={t('ldap-drawer.attributes-section.member-of.label', 'Member Of')}>
          <Input
            id="member-of"
            {...register('settings.config.servers.0.attributes.member_of')}
          />
        </Field>
        <Field htmlFor="email" label={t('ldap-drawer.attributes-section.email.label', 'Email')}>
          <Input
            id="email"
            {...register('settings.config.servers.0.attributes.email')}
          />
        </Field>
      </CollapsableSection>
      <CollapsableSection label={groupMappingsLabel} isOpen={true}>
        <Field
          htmlFor="skip-org-role-sync"
          label={t('ldap-drawer.group-mapping-section.skip-org-role-sync.label', 'Skip organization role sync')}
          description={t(
            'ldap-drawer.group-mapping-section.skip-org-role-sync.description',
            'Prevent synchronizing users’ organization roles from your IdP'
          )}
        >
          <Switch
            id="skip-org-role-sync"
            {...register('settings.config.servers.0.skip_org_role_sync')}
          />
        </Field>
        <Field
          htmlFor="group-search-filter"
          label={t('ldap-drawer.group-mapping-section.group-search-filter.label', 'Group search filter')}
          description={t(
            'ldap-drawer.group-mapping-section.group-search-filter.description',
            'Used to filter and identify group entries within the directory'
          )}
        >
          <Input
            id="group-search-filter"
            {...register('settings.config.servers.0.group_search_filter')}
          />
        </Field>
        <Field
          htmlFor="group-search-base-dns"
          label={t('ldap-drawer.group-mapping-section.group-search-base-dns.label', 'Group search base DNS')}
          description={t(
            'ldap-drawer.group-mapping-section.group-search-base-dns.description',
            'Separate by commas or spaces'
          )}
        >
          <Input
            id="group-search-base-dns"
            onChange={({ currentTarget: { value } }) => setValue('settings.config.servers.0.group_search_base_dns', [value])}
          />
        </Field>
        <Field
          htmlFor="group-search-filter-user-attribute"
          label={t(
            'ldap-drawer.group-mapping-section.group-search-filter-user-attribute.label',
            'Group name attribute'
          )}
          description={t(
            'ldap-drawer.group-mapping-section.group-search-filter-user-attribute.description',
            'Identifies users within group entries for filtering purposes'
          )}
        >
          <Input
            id="group-search-filter-user-attribute"
            {...register('settings.config.servers.0.group_search_filter_user_attribute')}
          />
        </Field>
        <Divider />
        {/* <Button className={styles.button} variant="secondary" icon="plus" onClick={() => onAddGroupMapping()}>
          <Trans i18nKey="ldap-drawer.group-mapping-section.add.button">Add group mapping</Trans>
        </Button> */}
      </CollapsableSection>
      <CollapsableSection
        label={t('ldap-drawer.extra-security-section.label', 'Extra security measures')}
        isOpen={true}
      >
        <Field
          htmlFor="use-ssl"
          label={t('ldap-drawer.extra-security-section.use-ssl.label', 'Use SSL')}
          description={t(
            'ldap-drawer.extra-security-section.use-ssl.description',
            'Set to true if LDAP server should use an encrypted TLS connection (either with STARTTLS or LDAPS)'
          )}
        >
          <Stack>
            <Switch
              id="use-ssl"
              {...register('settings.config.servers.0.use_ssl')}
            />
            <Tooltip content={useSslDescription} interactive>
              <Icon name="info-circle" />
            </Tooltip>
          </Stack>
        </Field>
        {watch('settings.config.servers.0.use_ssl') && (
          <>
            <Field
              label={t('ldap-drawer.extra-security-section.start-tls.label', 'Start TLS')}
              description={t(
                'ldap-drawer.extra-security-section.start-tls.description',
                'If set to true, use LDAP with STARTTLS instead of LDAPS'
              )}
            >
              <Switch
                id="start-tls"
                {...register('settings.config.servers.0.start_tls')}
              />
            </Field>
            <Field
              htmlFor="min-tls-version"
              label={t('ldap-drawer.extra-security-section.min-tls-version.label', 'Min TLS version')}
              description={t(
                'ldap-drawer.extra-security-section.min-tls-version.description',
                'This is the minimum TLS version allowed. Accepted values are: TLS1.2, TLS1.3.'
              )}
            >
              <Select
                id="min-tls-version"
                options={tlsOptions}
                value={watch('settings.config.servers.0.min_tls_version')}
                onChange={({value}) => setValue('settings.config.servers.0.min_tls_version', value)}
              />
            </Field>
            <Field
              label={t('ldap-drawer.extra-security-section.tls-ciphers.label', 'TLS ciphers')}
              description={t(
                'ldap-drawer.extra-security-section.tls-ciphers.description',
                'List of comma- or space-separated ciphers'
              )}
            >
              <Input
                id="tls-ciphers"
                placeholder={t(
                  'ldap-drawer.extra-security-section.tls-ciphers.placeholder',
                  'e.g. ["TLS_AES_256_GCM_SHA384"]'
                )}
                // onChange={({ currentTarget: { value } }) => onServerConfigChange({ tls_ciphers: value.split(' ') })}
              />
            </Field>
          </>
        )}
        {/* TODO: add a component to choose either Base64 encoded value or path to file */}
        {/* <Field label="Encryption key and certificate provision specification (required)" description="X.509 certificate provides the public part, while the private key issued in a PKCS#8 format provides the private part of the asymmetric encryption.">
          <Input placeholder='TODO: This is a Base64-enconded content or a Path to file'></Input>
        </Field>
        <Field label="Root CA certificate path" description="Separate by commas or spaces">
          <Input
            placeholder='/path/to/private_key.pem'
            defaultValue={ldapSettings.config.server.rootCaCert}
            onChange={({currentTarget: {value}}) => onServerConfigChange({rootCaCert: value})}
          />
        </Field>
        <Field label="Client certificate path">
          <Input
            placeholder='/path/to/certificate.cert'
            defaultValue={ldapSettings.config.server.clientCert}
            onChange={({currentTarget: {value}}) => onServerConfigChange({clientCert: value})}
          />
        </Field>
        <Field label="Client key path">
          <Input
            placeholder='/path/to/private_key.pem'
            defaultValue={ldapSettings.config.server.clientKey}
            onChange={({currentTarget: {value}}) => onServerConfigChange({clientKey: value})}
          />
        </Field> */}
      </CollapsableSection>
    </Drawer>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    sectionLabel: css({
      fontSize: theme.typography.size.lg,
    }),
    // button: css({
    //   marginBottom: theme.spacing(4),
    // }),
  };
}
