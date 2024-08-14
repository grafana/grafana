import { css } from '@emotion/css';
import { JSX } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  useStyles2,
  Button,
  CollapsableSection,
  Divider,
  Drawer,
  Field,
  Input,
  Select,
  Switch,
  Text,
} from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { GroupMapping, LdapServerConfig, LdapSettings, OrgRole } from 'app/types';
import { GroupMappingUnconnected } from './LdapGroupMapping';

interface OwnProps {
  onClose: () => void;
  onChange: (settings: LdapSettings) => void;
  ldapSettings: LdapSettings;
}

const mapStateToProps = () => ({});
const mapActionsToProps = {};

const connector = connect(mapStateToProps, mapActionsToProps);
export type Props = OwnProps & ConnectedProps<typeof connector>;

const tlsOptions: Array<SelectableValue<string>> = ['TLS1.2', 'TLS1.3'].map((v) => {
  return { label: v, value: v };
});

export const LdapDrawerUnconnected = ({ ldapSettings, onChange, onClose }: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  const onAddGroupMapping = () => {
    onChange({
      ...ldapSettings,
      config: {
        ...ldapSettings.config,
        server: {
          ...ldapSettings.config.server,
          groupMappings: [
            ...ldapSettings.config.server.groupMappings,
            {
              groupDn: '',
              orgId: 1,
              orgRole: OrgRole.Viewer,
              grafanaAdmin: false,
            },
          ],
        },
      },
    });
  };
  const onAttributeChange = (attribute: string, value: string) => {
    onChange({
      ...ldapSettings,
      config: {
        ...ldapSettings.config,
        server: {
          ...ldapSettings.config.server,
          attributes: {
            ...ldapSettings.config.server.attributes,
            [attribute]: value,
          },
        },
      },
    });
  };
  const onServerConfigChange = (serverConfig: Partial<LdapServerConfig>) => {
    onChange({
      ...ldapSettings,
      config: {
        ...ldapSettings.config,
        server: {
          ...ldapSettings.config.server,
          ...serverConfig,
        },
      },
    });
  };
  const onGroupMappingsChange = (groupMappings: GroupMapping[]) => {
    onChange({
      ...ldapSettings,
      config: {
        ...ldapSettings.config,
        server: {
          ...ldapSettings.config.server,
          groupMappings: groupMappings,
        },
      },
    });
  };

  return (
    <Drawer title={t('ldap-drawer.title', 'Advanced Settings')} onClose={onClose}>
      <CollapsableSection label={t('ldap-drawer.misc-section.label', 'Misc')} isOpen={true}>
        <Field
          htmlFor="allow-sign-up"
          label={t('ldap-drawer.misc-section.allow-sign-up.label', 'Allow sign up')}
          description={t(
            'ldap-drawer.misc-section.allow-sign-up.descrition',
            'If not enabled, only existing Grafana users can log in using LDAP'
          )}
        >
          <Switch
            id="allow-sign-up"
            value={ldapSettings.allowSignUp}
            onChange={() => {
              onChange({
                ...ldapSettings,
                allowSignUp: !ldapSettings.allowSignUp,
              });
            }}
          />
        </Field>
        <Field
          htmlFor="port"
          label={t('ldap-drawer.misc-section.port.label', 'Port')}
          description={t(
            'ldap-drawer.misc-section.port.description',
            'Default port is 389 without SSL or 636 with SSL'
          )}
        >
          <Input
            id="port"
            placeholder={t('ldap-drawer.misc-section.port.placeholder', '389')}
            defaultValue={ldapSettings.config.server.port.toString()}
            type="number"
            onChange={({ currentTarget: { value } }) => onServerConfigChange({ port: +value })}
          />
        </Field>
        <Field
          htmlFor="timeout"
          label={t('ldap-drawer.misc-section.timeout.labe', 'Timeout')}
          description={t(
            'ldap-drawer.misc-section.timeout.description',
            'Timeout in seconds for the connection to the LDAP server'
          )}
        >
          <Input
            id="timeout"
            placeholder={t('ldap-drawer.misc-section.timeout.placeholder', '389')}
            defaultValue={ldapSettings.config.server.timeout.toString()}
            type="number"
            onChange={({ currentTarget: { value } }) => onServerConfigChange({ timeout: +value })}
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
            defaultValue={ldapSettings.config.server?.attributes.name}
            onChange={({ currentTarget: { value } }) => onAttributeChange('name', value)}
          />
        </Field>
        <Field htmlFor="surname" label={t('ldap-drawer.attributes-section.surname.label', 'Surname')}>
          <Input
            id="surname"
            defaultValue={ldapSettings.config.server?.attributes.surname}
            onChange={({ currentTarget: { value } }) => onAttributeChange('surname', value)}
          />
        </Field>
        <Field htmlFor="username" label={t('ldap-drawer.attributes-section.username.label', 'Username')}>
          <Input
            id="username"
            defaultValue={ldapSettings.config.server?.attributes.username}
            onChange={({ currentTarget: { value } }) => onAttributeChange('username', value)}
          />
        </Field>
        <Field htmlFor="member-of" label={t('ldap-drawer.attributes-section.member-of.label', 'Member Of')}>
          <Input
            id="member-of"
            defaultValue={ldapSettings.config.server?.attributes.memberOf}
            onChange={({ currentTarget: { value } }) => onAttributeChange('memberOf', value)}
          />
        </Field>
        <Field htmlFor="email" label={t('ldap-drawer.attributes-section.email.label', 'Email')}>
          <Input
            id="email"
            defaultValue={ldapSettings.config.server?.attributes.email}
            onChange={({ currentTarget: { value } }) => onAttributeChange('email', value)}
          />
        </Field>
      </CollapsableSection>
      <CollapsableSection label={t('ldap-drawer.group-mapping-section.label', 'Group Mapping')} isOpen={true}>
        <Text>
          <Trans i18nKey="ldap-drawer.group-mapping-section.description">Map LDAP groups to grafana org roles</Trans>
        </Text>
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
            value={ldapSettings.config.server.skipOrgRoleSync}
            onChange={() => onServerConfigChange({ skipOrgRoleSync: !ldapSettings.config.server.skipOrgRoleSync })}
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
            defaultValue={ldapSettings.config.server.groupSearchFilter}
            onChange={({ currentTarget: { value } }) => onServerConfigChange({ groupSearchFilter: value })}
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
            defaultValue={ldapSettings.config.server.groupSearchBaseDns?.join(' ')}
            onChange={({ currentTarget: { value } }) => onServerConfigChange({ groupSearchBaseDns: value.split(' ') })}
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
            defaultValue={ldapSettings.config.server.groupSearchFilterUserAttribute}
            onChange={({ currentTarget: { value } }) => onServerConfigChange({ groupSearchFilterUserAttribute: value })}
          />
        </Field>
        {ldapSettings.config.server.groupMappings.map((gp, i) => (
          <GroupMappingUnconnected
            key={i}
            groupMapping={gp}
            onRemove={() => {
              ldapSettings.config.server.groupMappings!.splice(i, 1);
              onGroupMappingsChange([...ldapSettings.config.server.groupMappings!]);
            }}
            onChange={(updatedGroupMapping) => {
              ldapSettings.config.server.groupMappings![i] = {
                ...ldapSettings.config.server.groupMappings![i],
                ...updatedGroupMapping,
              };
              onGroupMappingsChange([...ldapSettings.config.server.groupMappings!]);
            }}
          />
        ))}
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
          htmlFor="ssl-skip-verify"
          label={t('ldap-drawer.extra-security-section.use-ssl.label', 'Use SSL')}
          description={t(
            'ldap-drawer.extra-security-section.use-ssl.description',
            'Set to true if LDAP server should use an encrypted TLS connection (either with STARTTLS or LDAPS)'
          )}
        >
          <Switch
            id="ssl-skip-verify"
            value={ldapSettings.config.server.useSsl}
            onChange={() => onServerConfigChange({ useSsl: !ldapSettings.config.server.useSsl })}
          />
        </Field>
        <Field
          htmlFor="start-tls"
          label={t('ldap-drawer.extra-security-section.start-tls.label', 'Start TLS')}
          description={t(
            'ldap-drawer.extra-security-section.start-tls.description',
            'If set to true, use LDAP with STARTTLS instead of LDAPS'
          )}
        >
          <Switch
            id="start-tls"
            value={ldapSettings.config.server.startTls}
            onChange={() => onServerConfigChange({ startTls: !ldapSettings.config.server.startTls })}
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
            value={ldapSettings.config.server.minTlsVersion}
            onChange={(v) => onServerConfigChange({ minTlsVersion: v.value })}
          />
        </Field>
        <Field
          htmlFor="tls-ciphers"
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
            defaultValue={ldapSettings.config.server.tlsCiphers?.join(' ')}
            onChange={({ currentTarget: { value } }) => onServerConfigChange({ tlsCiphers: value.split(' ') })}
          />
        </Field>
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
    button: css({
      marginBottom: theme.spacing(4),
    }),
  };
}

export const LdapDrawer = connector(LdapDrawerUnconnected);
