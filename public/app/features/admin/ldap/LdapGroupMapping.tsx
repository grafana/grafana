import { JSX } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { SelectableValue } from '@grafana/data';
import { Button, Divider, Field, Input, RadioButtonGroup, Switch } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { GroupMapping, OrgRole } from 'app/types';

const roleOptions: Array<SelectableValue<string>> = Object.keys(OrgRole).map((key) => {
  return { label: key, value: key };
});

interface GroupMappingProps {
  onRemove: () => void;
  onChange: (settings: GroupMapping) => void;
  groupMapping: GroupMapping;
}

const mapStateToProps = () => ({});
const mapActionsToProps = {};

const connector = connect(mapStateToProps, mapActionsToProps);
export type Props = GroupMappingProps & ConnectedProps<typeof connector>;

export const GroupMappingUnconnected = ({ onRemove, onChange, groupMapping }: Props): JSX.Element => {
  return (
    <div>
      <Divider />
      <Field
        htmlFor="group-dn"
        label={t('ldap-drawer.group-mapping.group-dn.label', 'Group DN')}
        description={t(
          'ldap-drawer.group-mapping.group-dn.description',
          'The name of the key used to extract the ID token from the returned OAuth2 token.'
        )}
      >
        <Input
          id="group-dn"
          defaultValue={groupMapping.groupDn}
          onChange={({ currentTarget: { value } }) => onChange({ ...groupMapping, groupDn: value })}
        ></Input>
      </Field>
      <Field htmlFor="org-role" label={t('ldap-drawer.group-mapping.org-role.label', 'Org role *')}>
        <RadioButtonGroup
          id="org-role"
          options={roleOptions}
          value={groupMapping.orgRole}
          onChange={(role) => onChange({ ...groupMapping, orgRole: role })}
        />
      </Field>
      <Field
        htmlFor="org-id"
        label={t('ldap-drawer.group-mapping.org-id.label', 'Org ID')}
        description={t(
          'ldap-drawer.group-mapping.org-id.description',
          'The Grafana organization database id. Default org (ID 1) will be used if left out'
        )}
      >
        <Input
          id="org-id"
          defaultValue={groupMapping.orgId}
          onChange={({ currentTarget: { value } }) => onChange({ ...groupMapping, orgId: +value })}
        />
      </Field>
      <Field
        htmlFor="grafana-admin"
        label={t('ldap-drawer.group-mapping.grafana-admin.label', 'Grafana Admin')}
        description={t(
          'ldap-drawer.group-mapping.grafana-admin.description',
          'If enabled, all users from this group will be Grafana Admins'
        )}
      >
        <Switch
          id="grafana-admin"
          value={groupMapping.grafanaAdmin}
          onChange={() => onChange({ ...groupMapping, grafanaAdmin: !groupMapping.grafanaAdmin })}
        />
      </Field>
      <Button variant="secondary" fill="outline" icon="trash-alt" onClick={onRemove}>
        <Trans i18nKey="ldap-drawer.group-mapping.remove.button">Remove group mapping</Trans>
      </Button>
    </div>
  );
};

export const GroupMappingComponent = connector(GroupMappingUnconnected);
