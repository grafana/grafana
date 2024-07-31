import { JSX } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Button, CollapsableSection, Drawer, Field, Input, Switch, Text } from '@grafana/ui';
import { StoreState } from 'app/types';

interface OwnProps {
  onClose: () => void;
}

const mapStateToProps = (state: StoreState) => {
  // const allowInsecureEmail =
  //   state.authConfig.settings?.auth?.oauth_allow_insecure_email_lookup.toLowerCase() === 'true';
  return {
    // allowInsecureEmail,
  };
};

const mapActionsToProps = {
  // loadSettings,
  // saveSettings,
};

const connector = connect(mapStateToProps, mapActionsToProps);
export type Props = OwnProps & ConnectedProps<typeof connector>;

function addGroupMapping() {
  console.log('Add group mapping');
}

export const LdapDrawerUnconnected = ({
  // allowInsecureEmail,
  // loadSettings,
  onClose,
  // saveSettings,
}: Props): JSX.Element => {
  return (
    <Drawer title="Advanced Settings" onClose={onClose}>
      <CollapsableSection label="Misc" isOpen={true}>
        <Field label="Allow sign up" description="If not enabled, only existing Grafana users can log in using LDAP">
          <Switch/>
        </Field>
        <Field label="Port" description="Default port is 389 without SSL or 636 with SSL">
          <Input placeholder="389"></Input>
        </Field>
        <Field label="Timeout" description="Timeout in seconds. Applies to each host specified in the “host” entry">
          <Input placeholder="10s"></Input>
        </Field>
      </CollapsableSection>
      <CollapsableSection label="Attributes" isOpen={true}>
        <Text color="secondary">Specify the LDAP attributes that map to the user&lsquo;s given name, surname, and email address, ensuring the application correctly retrieves and displays user information.</Text>
        <Field label="Name">
          <Input></Input>
        </Field>
        <Field label="Surname">
          <Input></Input>
        </Field>
        <Field label="Member Of">
          <Input></Input>
        </Field>
        <Field label="Email">
          <Input></Input>
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
        <Button variant='secondary' onClick={addGroupMapping}>+ Add group mapping</Button>
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
