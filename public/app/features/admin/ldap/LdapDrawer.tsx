import { css } from '@emotion/css';
import { Component, JSX } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { useStyles2, Button, CollapsableSection, Divider, Drawer, Field, Input, RadioButtonGroup, Switch, Text } from '@grafana/ui';
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

const roleOptions: Array<SelectableValue<string>> = Object.keys(OrgRole).map((key) => {return {label: key, value: key};});

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
        <Field label="Group DN" description="The name of the key used to extract the ID token from the returned OAuth2 token.">
          <Input defaultValue={groupMapping.groupDn} onChange={e => onChange({...groupMapping, groupDn: e.currentTarget.value})}></Input>
        </Field>
        <Field label="Org role *">
          <RadioButtonGroup options={roleOptions} value={groupMapping.orgRole} onChange={role => onChange({...groupMapping, orgRole: role})} />
        </Field>
        <Field label="Org ID" description="The Grafana organization database id. Default org (ID 1) will be used if left out">
          <Input defaultValue={groupMapping.orgId} onChange={e => onChange({...groupMapping, orgId: +e.currentTarget.value})}></Input>
        </Field>
        <Field label="Grafana Admin" description="If enabled, all users from this group will be Grafana Admins">
          <Switch value={groupMapping.grafanaAdmin} onChange={() => onChange({...groupMapping, grafanaAdmin: !groupMapping.grafanaAdmin})} />
        </Field>
        <Button variant='secondary' fill="outline" icon="trash-alt" onClick={onRemove}>Remove group mapping</Button>
      </div>
    );
  }
}

export const LdapDrawerUnconnected = ({
  ldapSettings,
  onChange,
  onClose,
}: Props): JSX.Element => {
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
              grafanaAdmin: false
            }
          ]
        }
      }
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
            [attribute]: value
          }
        }
      }
    });
  }
  const onServerConfigChange = (serverConfig: LdapServerConfig) => {
    onChange({
      ...ldapSettings,
      config: {
        ...ldapSettings.config,
        server: {
          ...ldapSettings.config.server,
          ...serverConfig
        }
      }
    });
  }
  const onGroupMappingsChange = (groupMappings: GroupMapping[]) => {
    onChange({
      ...ldapSettings,
      config: {
        ...ldapSettings.config,
        server: {
          ...ldapSettings.config.server,
          groupMappings: groupMappings
        }
      }
    });
  };

  return (
    <Drawer title="Advanced Settings" onClose={onClose}>
      <CollapsableSection label="Misc" isOpen={true}>
        <Field label="Allow sign up" description="If not enabled, only existing Grafana users can log in using LDAP">
          <Switch
            value={ldapSettings.allowSignUp}
            onChange={() => {
              onChange({
                ...ldapSettings,
                allowSignUp: !ldapSettings.allowSignUp,
              });
            }
            }
          />
        </Field>
        <Field label="Port" description="Default port is 389 without SSL or 636 with SSL">
          <Input
            placeholder='389'
            defaultValue={ldapSettings.config.server.port.toString()}
            type='number'
            onChange={e => {
              onServerConfigChange({
                ...ldapSettings.config.server,
                port: +e.currentTarget.value
              });
            }}
          />
        </Field>
        <Field label="Timeout" description="Timeout in seconds. Applies to each host specified in the “host” entry">
          <Input
            placeholder="10"
            defaultValue={ldapSettings.config.server.timeout.toString()}
            type='number'
            onChange={e => {
              onServerConfigChange({
                ...ldapSettings.config.server,
                timeout: +e.currentTarget.value
              });
            }}
          />
        </Field>
      </CollapsableSection>
      <CollapsableSection label="Attributes" isOpen={true}>
        <Text color="secondary">Specify the LDAP attributes that map to the user&lsquo;s given name, surname, and email address, ensuring the application correctly retrieves and displays user information.</Text>
        <Field label="Name">
        <Input defaultValue={ldapSettings.config.server?.attributes.name} onChange={e => onAttributeChange('name', e.currentTarget.value)}/>
        </Field>
        <Field label="Surname">
          <Input defaultValue={ldapSettings.config.server?.attributes.surname} onChange={e => onAttributeChange('surname', e.currentTarget.value)}/>
        </Field>
        <Field label="Member Of">
          <Input defaultValue={ldapSettings.config.server?.attributes.memberOf} onChange={e => onAttributeChange('memberOf', e.currentTarget.value)}/>
        </Field>
        <Field label="Email">
          <Input defaultValue={ldapSettings.config.server?.attributes.email} onChange={e => onAttributeChange('email', e.currentTarget.value)}/>
        </Field>
      </CollapsableSection>
      <CollapsableSection label="Group Mapping" isOpen={true}>
        <Text>Map ldap groups to grafana org roles</Text>
        <Field label="Skip organization role sync" description="Prevent synchronizing users’ organization roles from your IdP">
          <Switch/>
        </Field>
        <Field label="Group search filter" description="Used to filter and identify group entries within the directory">
          <Input></Input>
        </Field>
        <Field label="Group search base DNS" description="Separate by commas or spaces">
          <Input></Input>
        </Field>
        <Field label="Group name attribute" description="Identifies users within group entries for filtering purposes">
          <Input></Input>
        </Field>
        {ldapSettings.config.server.groupMappings.map((gp, i) =>
          <GroupMappingComponent
            key={i}
            groupMapping={gp}
            onRemove={() => {
              ldapSettings.config.server.groupMappings!.splice(i, 1);
              onGroupMappingsChange([...ldapSettings.config.server.groupMappings!]);
            }}
            onChange={(updatedGroupMapping) => {
              ldapSettings.config.server.groupMappings![i] = {...ldapSettings.config.server.groupMappings![i], ...updatedGroupMapping};
              onGroupMappingsChange([...ldapSettings.config.server.groupMappings!]);
            }}
          />
        )}
        <Divider />
        <Button className={styles.button} variant='secondary' icon="plus" onClick={() => onAddGroupMapping()}>Add group mapping</Button>
      </CollapsableSection>
      {/* TODO: add some spacing here */}
      <CollapsableSection label="Extra security measures" isOpen={true}>
        <Field label="Use SSL" description="Set to true if LDAP server should use an encrypted TLS connection (either with STARTTLS or LDAPS)">
          <Switch/>
        </Field>
        <Field label="Start TLS" description="If set to true, use LDAP with STARTTLS instead of LDAPS">
          <Switch/>
        </Field>
        <Field label="Min TLS version" description="This is the minimum TLS version allowed. Accepted values are: TLS1.1, TLS1.2, TLS1.3.">
          <Input placeholder='TODO: This is a dropdown menu'></Input>
        </Field>
        <Field label="TLS ciphers" description="List of comma- or space-separated ciphers">
          <Input placeholder='e.g. ["TLS_AES_256_GCM_SHA384"]'></Input>
        </Field>
        <Field label="Encryption key and certificate provision specification (required)" description="X.509 certificate provides the public part, while the private key issued in a PKCS#8 format provides the private part of the asymmetric encryption.">
          <Input placeholder='TODO: This is a Base64-enconded content or a Path to file'></Input>
        </Field>
        <Field label="Root CA certificate path" description="Separate by commas or spaces">
          <Input placeholder='/path/to/private_key.pem'></Input>
        </Field>
        <Field label="Client certificate path">
          <Input placeholder='/path/to/certificate.cert'></Input>
        </Field>
        <Field label="Client key path">
          <Input placeholder='/path/to/private_key.pem'></Input>
        </Field>
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
