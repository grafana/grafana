import { Component, JSX } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { SelectableValue } from '@grafana/data';
import { Button, CollapsableSection, Divider, Drawer, Field, Input, RadioButtonGroup, Switch, Text } from '@grafana/ui';
import { GroupMapping, LdapSsoSettings, OrgRole } from 'app/types';

interface OwnProps {
  onClose: () => void;
  onChange: (settings: LdapSsoSettings | undefined) => void;
  ldapSsoSettings?: LdapSsoSettings;
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
          <Input defaultValue={groupMapping.orgId} onChange={e => onChange({...groupMapping, orgId: e.currentTarget.value})}></Input>
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
  ldapSsoSettings,
  onChange,
  onClose,
}: Props): JSX.Element => {
  const onAddGroupMapping = () => {
    onChange({
      ...ldapSsoSettings,
      groupMappings: [
        ...ldapSsoSettings?.groupMappings!,
        { orgRole: 'Viewer' }
      ]});
  };

  return (
    <Drawer title="Advanced Settings" onClose={onClose}>
      <CollapsableSection label="Misc" isOpen={true}>
        <Field label="Allow sign up" description="If not enabled, only existing Grafana users can log in using LDAP">
          <Switch/>
        </Field>
        <Field label="Port" description="Default port is 389 without SSL or 636 with SSL">
          <Input placeholder="389" />
        </Field>
        <Field label="Timeout" description="Timeout in seconds. Applies to each host specified in the “host” entry">
          <Input placeholder="10s" />
        </Field>
      </CollapsableSection>
      <CollapsableSection label="Attributes" isOpen={true}>
        <Text color="secondary">Specify the LDAP attributes that map to the user&lsquo;s given name, surname, and email address, ensuring the application correctly retrieves and displays user information.</Text>
        <Field label="Name">
        <Input defaultValue={ldapSsoSettings?.attributes?.name} onChange={e => {
            onChange({attributes: {...ldapSsoSettings?.attributes, name: e.currentTarget.value}});
          }}/>
        </Field>
        <Field label="Surname">
          <Input defaultValue={ldapSsoSettings?.attributes?.surname} onChange={e => {
            onChange({attributes: {...ldapSsoSettings?.attributes, surname: e.currentTarget.value}});
          }}/>
        </Field>
        <Field label="Member Of">
          <Input defaultValue={ldapSsoSettings?.attributes?.memberOf} onChange={e => {
            onChange({attributes: {...ldapSsoSettings?.attributes, memberOf: e.currentTarget.value}});
          }}/>
        </Field>
        <Field label="Email">
          <Input defaultValue={ldapSsoSettings?.attributes?.email} onChange={e => {
            onChange({attributes: {...ldapSsoSettings?.attributes, email: e.currentTarget.value}});
          }}/>
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
        {ldapSsoSettings?.groupMappings?.map((gp, i) =>
          <GroupMappingComponent
            key={i}
            groupMapping={gp}
            onRemove={() => {
              ldapSsoSettings.groupMappings!.splice(i, 1);
              onChange(ldapSsoSettings);
            }}
            onChange={(updatedGroupMapping) => {
              ldapSsoSettings.groupMappings![i] = {...ldapSsoSettings.groupMappings![i], ...updatedGroupMapping};
              onChange(ldapSsoSettings);
            }}
          />
        )}
        <Divider />
        <Button variant='secondary' icon="plus" onClick={() => onAddGroupMapping()}>Add group mapping</Button>
      </CollapsableSection>
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

export const LdapDrawer = connector(LdapDrawerUnconnected);
