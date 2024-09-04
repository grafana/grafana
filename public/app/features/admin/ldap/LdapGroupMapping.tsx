import { SelectableValue } from '@grafana/data';
import { Box, Button, Field, Input, RadioButtonGroup, Switch } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { GroupMapping, OrgRole } from 'app/types';

const roleOptions: Array<SelectableValue<string>> = Object.keys(OrgRole).map(key => {
  return { label: key, value: key };
});

interface GroupMappingProps {
  onRemove: () => void;
  onChange: (settings: GroupMapping) => void;
  groupMapping: GroupMapping;
}

export const GroupMappingComponent = ({ groupMapping, onRemove, onChange }: GroupMappingProps) => {
  return (
    <Box borderColor="strong" borderStyle="solid" padding={2} marginBottom={2}>
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
          defaultValue={groupMapping.group_dn}
        />
      </Field>
      <Field htmlFor="org-role" label={t('ldap-drawer.group-mapping.org-role.label', 'Org role *')}>
        <RadioButtonGroup
          id="org-role"
          options={roleOptions}
          value={groupMapping.org_role}
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
          defaultValue={groupMapping.org_id}
          onChange={({ currentTarget: { value } }) => onChange({ ...groupMapping, org_id: +value })}
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
          value={groupMapping.grafana_admin}
          onChange={() => onChange({ ...groupMapping, grafana_admin: !groupMapping.grafana_admin })}
        />
      </Field>
      <Button variant="secondary" fill="outline" icon="trash-alt" onClick={onRemove}>
        <Trans i18nKey="ldap-drawer.group-mapping.remove.button">Remove group mapping</Trans>
      </Button>
    </Box>
  );
};
