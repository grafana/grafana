import { css } from '@emotion/css';
import { Component, JSX } from 'react';
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
  RadioButtonGroup,
  Select,
  Switch,
  Text,
} from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { GroupMapping, LdapServerConfig, LdapSettings, OrgRole } from 'app/types';

interface OwnProps {
  onClose: () => void;
  onChange: (settings: LdapSettings) => void;
  ldapSettings: LdapSettings;
}

const mapStateToProps = () => ({});
const mapActionsToProps = {};

const connector = connect(mapStateToProps, mapActionsToProps);
export type Props = OwnProps & ConnectedProps<typeof connector>;

const roleOptions: Array<SelectableValue<string>> = Object.keys(OrgRole).map((key) => {
  return { label: key, value: key };
});

const tlsOptions: Array<SelectableValue<string>> = ['TLS1.1', 'TLS1.2', 'TLS1.3'].map((v) => {
  return { label: v, value: v };
});

interface GroupMappingProps {
  onRemove: () => void;
  onChange: (settings: GroupMapping) => void;
  groupMapping: GroupMapping;
}
class GroupMappingComponent extends Component<GroupMappingProps> {
  render() {
    const { groupMapping, onChange, onRemove } = this.props;
    return (
      <div>
        <Divider />
        <Field
          label={<Trans i18nKey="ldap-drawer.group-mapping.group-dn.label">Group DN</Trans>}
          description={
            <Trans i18nKey="ldap-drawer.group-mapping.group-dn.description">
              The name of the key used to extract the ID token from the returned OAuth2 token.
            </Trans>
          }
        >
          <Input
            defaultValue={groupMapping.groupDn}
            onChange={({ currentTarget: { value } }) => onChange({ ...groupMapping, groupDn: value })}
          ></Input>
        </Field>
        <Field label={<Trans i18nKey="ldap-drawer.group-mapping.org-role.label">Org role *</Trans>}>
          <RadioButtonGroup
            options={roleOptions}
            value={groupMapping.orgRole}
            onChange={(role) => onChange({ ...groupMapping, orgRole: role })}
          />
        </Field>
        <Field
          label={<Trans i18nKey="ldap-drawer.group-mapping.org-id.label">Org ID</Trans>}
          description={
            <Trans i18nKey="ldap-drawer.group-mapping.org-id.description">
              The Grafana organization database id. Default org (ID 1) will be used if left out
            </Trans>
          }
        >
          <Input
            defaultValue={groupMapping.orgId}
            onChange={({ currentTarget: { value } }) => onChange({ ...groupMapping, orgId: +value })}
          ></Input>
        </Field>
        <Field
          label={<Trans i18nKey="ldap-drawer.group-mapping.grafana-admin.label">Grafana Admin</Trans>}
          description={
            <Trans i18nKey="ldap-drawer.group-mapping.grafana-admin.description">
              If enabled, all users from this group will be Grafana Admins
            </Trans>
          }
        >
          <Switch
            value={groupMapping.grafanaAdmin}
            onChange={() => onChange({ ...groupMapping, grafanaAdmin: !groupMapping.grafanaAdmin })}
          />
        </Field>
        <Button variant="secondary" fill="outline" icon="trash-alt" onClick={onRemove}>
          <Trans i18nKey="ldap-drawer.group-mapping.remove.button">Remove group mapping</Trans>
        </Button>
      </div>
    );
  }
}

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
    <Drawer title={<Trans i18nKey="ldap-drawer.title">Advanced Settings</Trans>} onClose={onClose}>
      <CollapsableSection label={<Trans i18nKey="ldap-drawer.misc-section.label">Misc</Trans>} isOpen={true}>
        <Field
          label={<Trans i18nKey="ldap-drawer.misc-section.allow-sign-up.label">Allow sign up</Trans>}
          description={
            <Trans i18nKey="ldap-drawer.misc-section.allow-sign-up.descrition">
              If not enabled, only existing Grafana users can log in using LDAP
            </Trans>
          }
        >
          <Switch
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
          label={<Trans i18nKey="ldap-drawer.misc-section.port.label">Port</Trans>}
          description={
            <Trans i18nKey="ldap-drawer.misc-section.port.description">
              Default port is 389 without SSL or 636 with SSL
            </Trans>
          }
        >
          <Input
            placeholder={t('ldap-drawer.misc-section.port.placeholder', '389')}
            defaultValue={ldapSettings.config.server.port.toString()}
            type="number"
            onChange={({ currentTarget: { value } }) => onServerConfigChange({ port: +value })}
          />
        </Field>
        <Field
          label={<Trans i18nKey="ldap-drawer.misc-section.timeout.label">Timeout</Trans>}
          description={<Trans i18nKey="ldap-drawer.misc-section.timeout.description">Timeout</Trans>}
        >
          <Input
            placeholder={t('ldap-drawer.misc-section.timeout.placeholder', '389')}
            defaultValue={ldapSettings.config.server.timeout.toString()}
            type="number"
            onChange={({ currentTarget: { value } }) => onServerConfigChange({ timeout: +value })}
          />
        </Field>
      </CollapsableSection>
      <CollapsableSection
        label={<Trans i18nKey="ldap-drawer.attributes-section.label">Attributes</Trans>}
        isOpen={true}
      >
        <Text color="secondary">
          <Trans i18nKey="ldap-drawer.attributes-section.description">
            Specify the LDAP attributes that map to the user&lsquo;s given name, surname, and email address, ensuring
            the application correctly retrieves and displays user information.
          </Trans>
        </Text>
        <Field label={<Trans i18nKey="ldap-drawer.attributes-section.name.label">Name</Trans>}>
          <Input
            defaultValue={ldapSettings.config.server?.attributes.name}
            onChange={({ currentTarget: { value } }) => onAttributeChange('name', value)}
          />
        </Field>
        <Field label={<Trans i18nKey="ldap-drawer.attributes-section.surname.label">Surname</Trans>}>
          <Input
            defaultValue={ldapSettings.config.server?.attributes.surname}
            onChange={({ currentTarget: { value } }) => onAttributeChange('surname', value)}
          />
        </Field>
        <Field label={<Trans i18nKey="ldap-drawer.attributes-section.member-of.label">Member Of</Trans>}>
          <Input
            defaultValue={ldapSettings.config.server?.attributes.memberOf}
            onChange={({ currentTarget: { value } }) => onAttributeChange('memberOf', value)}
          />
        </Field>
        <Field label={<Trans i18nKey="ldap-drawer.attributes-section.email.label">Email</Trans>}>
          <Input
            defaultValue={ldapSettings.config.server?.attributes.email}
            onChange={({ currentTarget: { value } }) => onAttributeChange('email', value)}
          />
        </Field>
      </CollapsableSection>
      <CollapsableSection
        label={<Trans i18nKey="ldap-drawer.group-mapping-section.label">Group Mapping</Trans>}
        isOpen={true}
      >
        <Text>
          <Trans i18nKey="ldap-drawer.group-mapping-section.description">Map LDAP groups to grafana org roles</Trans>
        </Text>
        <Field
          label={
            <Trans i18nKey="ldap-drawer.group-mapping-section.skip-org-role-sync.label">
              Skip organization role sync
            </Trans>
          }
          description={
            <Trans i18nKey="ldap-drawer.group-mapping-section.skip-org-role-sync.description">
              Prevent synchronizing users’ organization roles from your IdP
            </Trans>
          }
        >
          <Switch
            value={ldapSettings.config.server.skipOrgRoleSync}
            onChange={() => onServerConfigChange({ skipOrgRoleSync: !ldapSettings.config.server.skipOrgRoleSync })}
          />
        </Field>
        <Field
          label={
            <Trans i18nKey="ldap-drawer.group-mapping-section.group-search-filter.label">Group search filter</Trans>
          }
          description={
            <Trans i18nKey="ldap-drawer.group-mapping-section.group-search-filter.description">
              Used to filter and identify group entries within the directory
            </Trans>
          }
        >
          <Input
            defaultValue={ldapSettings.config.server.groupSearchFilter}
            onChange={({ currentTarget: { value } }) => onServerConfigChange({ groupSearchFilter: value })}
          />
        </Field>
        <Field
          label={
            <Trans i18nKey="ldap-drawer.group-mapping-section.group-search-base-dns.label">Group search base DNS</Trans>
          }
          description={
            <Trans i18nKey="ldap-drawer.group-mapping-section.group-search-base-dns.description">
              Separate by commas or spaces
            </Trans>
          }
        >
          <Input
            defaultValue={ldapSettings.config.server.groupSearchBaseDns?.join(' ')}
            onChange={({ currentTarget: { value } }) => onServerConfigChange({ groupSearchBaseDns: value.split(' ') })}
          />
        </Field>
        <Field
          label={
            <Trans i18nKey="ldap-drawer.group-mapping-section.group-search-filter-user-attribute.label">
              Group name attribute
            </Trans>
          }
          description={
            <Trans i18nKey="ldap-drawer.group-mapping-section.group-search-filter-user-attribute.description">
              Identifies users within group entries for filtering purposes
            </Trans>
          }
        >
          <Input
            defaultValue={ldapSettings.config.server.groupSearchFilterUserAttribute}
            onChange={({ currentTarget: { value } }) => onServerConfigChange({ groupSearchFilterUserAttribute: value })}
          />
        </Field>
        {ldapSettings.config.server.groupMappings.map((gp, i) => (
          <GroupMappingComponent
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
        label={<Trans i18nKey="ldap-drawer.extra-security-section.label">Extra security measures</Trans>}
        isOpen={true}
      >
        <Field
          label={<Trans i18nKey="ldap-drawer.extra-security-section.use-ssl.label">Use SSL</Trans>}
          description={
            <Trans i18nKey="ldap-drawer.extra-security-section.use-ssl.description">
              Set to true if LDAP server should use an encrypted TLS connection (either with STARTTLS or LDAPS)
            </Trans>
          }
        >
          <Switch
            value={ldapSettings.config.server.useSsl}
            onChange={() => onServerConfigChange({ useSsl: !ldapSettings.config.server.useSsl })}
          />
        </Field>
        <Field
          label={<Trans i18nKey="ldap-drawer.extra-security-section.start-tls.label">Start TLS</Trans>}
          description={
            <Trans i18nKey="ldap-drawer.extra-security-section.start-tls.description">
              If set to true, use LDAP with STARTTLS instead of LDAPS
            </Trans>
          }
        >
          <Switch
            value={ldapSettings.config.server.startTls}
            onChange={() => onServerConfigChange({ startTls: !ldapSettings.config.server.startTls })}
          />
        </Field>
        <Field
          label={<Trans i18nKey="ldap-drawer.extra-security-section.min-tls-version.label">Min TLS version</Trans>}
          description={
            <Trans i18nKey="ldap-drawer.extra-security-section.min-tls-version.description">
              This is the minimum TLS version allowed. Accepted values are: TLS1.1, TLS1.2, TLS1.3.
            </Trans>
          }
        >
          <Select
            options={tlsOptions}
            value={ldapSettings.config.server.minTlsVersion}
            onChange={(v) => onServerConfigChange({ minTlsVersion: v.value })}
          ></Select>
        </Field>
        <Field
          label={<Trans i18nKey="ldap-drawer.extra-security-section.tls-ciphers.label">TLS ciphers</Trans>}
          description={
            <Trans i18nKey="ldap-drawer.extra-security-section.tls-ciphers.description">
              List of comma- or space-separated ciphers
            </Trans>
          }
        >
          <Input
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
