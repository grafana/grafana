import { useFormContext } from 'react-hook-form';

import { OrgRole, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, Field, Input, RadioButtonGroup, Switch } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { LdapPayload } from 'app/types/ldap';

const roleOptions: Array<SelectableValue<string>> = Object.keys(OrgRole).map((key) => {
  return { label: key, value: key };
});

interface GroupMappingProps {
  onRemove: () => void;
  groupMappingIndex: number;
}

export const GroupMappingComponent = ({ groupMappingIndex, onRemove }: GroupMappingProps) => {
  const { getValues, register, setValue } = useFormContext<LdapPayload>();

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
        <Input id="group-dn" {...register(`settings.config.servers.0.group_mappings.${groupMappingIndex}.group_dn`)} />
      </Field>
      <Field label={t('ldap-drawer.group-mapping.org-role.label', 'Org role *')}>
        <RadioButtonGroup
          id={`org-role-${groupMappingIndex}`}
          options={roleOptions}
          value={getValues(`settings.config.servers.0.group_mappings.${groupMappingIndex}.org_role`)}
          onChange={(v) => setValue(`settings.config.servers.0.group_mappings.${groupMappingIndex}.org_role`, v)}
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
          type="number"
          {...register(`settings.config.servers.0.group_mappings.${groupMappingIndex}.org_id`, { valueAsNumber: true })}
        />
      </Field>
      {contextSrv.isGrafanaAdmin && (
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
            {...register(`settings.config.servers.0.group_mappings.${groupMappingIndex}.grafana_admin`)}
          />
        </Field>
      )}
      <Button variant="secondary" fill="outline" icon="trash-alt" onClick={onRemove}>
        <Trans i18nKey="ldap-drawer.group-mapping.remove.button">Remove group mapping</Trans>
      </Button>
    </Box>
  );
};
