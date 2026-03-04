import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2, OrgRole, SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, IconButton, RadioButtonGroup, Select, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { Role } from 'app/types/accessControl';

const BASIC_ROLE_OPTIONS: Array<SelectableValue<OrgRole>> = [
  { label: 'None', value: OrgRole.None },
  { label: 'Viewer', value: OrgRole.Viewer },
  { label: 'Editor', value: OrgRole.Editor },
  { label: 'Admin', value: OrgRole.Admin },
];

const tooltipMessage = (
  <Trans i18nKey="role-picker-drawer.basic-role-tooltip">
    Viewer, Editor, and Admin are cumulative &mdash; Editor includes everything in Viewer plus more.
    Select &quot;None&quot; to start from zero.{' '}
    <TextLink
      href="https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/"
      variant="bodySmall"
      external
    >
      View role definitions
    </TextLink>
  </Trans>
);

interface Props {
  basicRole: OrgRole;
  appliedRoles: Role[];
  roleOptions: Role[];
  basicRoleDisabled?: boolean;
  disabledMessage?: string;
  canUpdateRoles: boolean;
  onUpdate: (newRoles: Role[], newBasicRole?: OrgRole) => void;
}

export const AssignRoles = ({
  basicRole,
  appliedRoles,
  roleOptions,
  basicRoleDisabled,
  disabledMessage,
  canUpdateRoles,
  onUpdate,
}: Props) => {
  const styles = useStyles2(getStyles);
  const [selectedBasicRole, setSelectedBasicRole] = useState<OrgRole>(basicRole);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(appliedRoles);

  // Build grouped options for the Add Role select, excluding already-selected
  const addRoleOptions = useMemo(() => {
    const selectedUids = new Set(selectedRoles.map((r) => r.uid));

    const toOption = (r: Role): SelectableValue<string> => ({
      label: r.displayName || r.name,
      value: r.uid,
      description: r.group || undefined,
    });

    const fixed = roleOptions
      .filter((r) => r.name.startsWith('fixed:') && !selectedUids.has(r.uid) && r.delegatable)
      .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name))
      .map(toOption);

    const custom = roleOptions
      .filter((r) => !r.name.startsWith('fixed:') && !r.name.startsWith('plugins:') && !selectedUids.has(r.uid) && r.delegatable)
      .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name))
      .map(toOption);

    const plugin = roleOptions
      .filter((r) => r.name.startsWith('plugins:') && !selectedUids.has(r.uid) && r.delegatable)
      .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name))
      .map(toOption);

    const groups: Array<SelectableValue<string>> = [];
    if (fixed.length) {
      groups.push({ label: 'Fixed roles', options: fixed });
    }
    if (custom.length) {
      groups.push({ label: 'Custom roles', options: custom });
    }
    if (plugin.length) {
      groups.push({ label: 'Plugin roles', options: plugin });
    }
    return groups;
  }, [roleOptions, selectedRoles]);

  const handleAddRole = (selected: SelectableValue<string>) => {
    if (!selected.value) {
      return;
    }
    const role = roleOptions.find((r) => r.uid === selected.value);
    if (role) {
      setSelectedRoles((prev) => [...prev, role]);
    }
  };

  const handleRemoveRole = (uid: string) => {
    setSelectedRoles((prev) => prev.filter((r) => r.uid !== uid));
  };

  const handleClear = () => {
    // Keep mapped (IdP) roles that can't be removed
    setSelectedRoles(selectedRoles.filter((r) => r.mapped));
  };

  const handleSave = () => {
    onUpdate(selectedRoles, selectedBasicRole);
  };

  const hasChanges =
    selectedBasicRole !== basicRole ||
    selectedRoles.length !== appliedRoles.length ||
    selectedRoles.some((r) => !appliedRoles.find((a) => a.uid === r.uid));

  return (
    <div className={styles.container}>
      {/* Basic role selector */}
      <div className={styles.section}>
        <Stack direction="row" gap={1} alignItems="center">
          <Text weight="medium">
            {t('role-picker-drawer.basic-role-label', 'Basic role')}
          </Text>
          <Tooltip content={tooltipMessage} interactive>
            <IconButton name="info-circle" size="sm" aria-label="Basic role info" />
          </Tooltip>
        </Stack>
        {basicRoleDisabled && disabledMessage && (
          <Text color="secondary" variant="bodySmall" italic>
            {disabledMessage}
          </Text>
        )}
        <RadioButtonGroup
          options={BASIC_ROLE_OPTIONS}
          value={selectedBasicRole}
          onChange={setSelectedBasicRole}
          disabled={basicRoleDisabled}
          size="md"
        />
      </div>

      {/* Assigned roles */}
      <div className={styles.section}>
        <Text weight="medium">
          {t('role-picker-drawer.assigned-roles-label', 'Assigned roles')}
        </Text>
        {selectedRoles.length > 0 ? (
          <div className={styles.roleList}>
            {selectedRoles.map((role) => (
              <div key={role.uid} className={styles.roleCard}>
                <div className={styles.roleInfo}>
                  <Text>{role.displayName || role.name}</Text>
                  {role.group && (
                    <Text color="secondary" variant="bodySmall">
                      {role.group}
                    </Text>
                  )}
                </div>
                {role.mapped ? (
                  <Tooltip content={t('role-picker-drawer.mapped-tooltip', 'Synced from identity provider')}>
                    <IconButton name="lock" size="sm" aria-label="Mapped role" />
                  </Tooltip>
                ) : (
                  <IconButton
                    name="trash-alt"
                    size="sm"
                    onClick={() => handleRemoveRole(role.uid)}
                    aria-label={t('role-picker-drawer.remove-role', 'Remove {{role}}', {
                      role: role.displayName || role.name,
                    })}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <Text color="secondary" italic>
            {t('role-picker-drawer.no-roles', 'No additional roles assigned')}
          </Text>
        )}
      </div>

      {/* Add role */}
      {canUpdateRoles && (
        <div className={styles.section}>
          <Select
            options={addRoleOptions}
            onChange={handleAddRole}
            placeholder={t('role-picker-drawer.add-role-placeholder', 'Add a role...')}
            isClearable
            isSearchable
            value={null}
            menuShouldPortal
          />
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <Button size="sm" fill="text" onClick={handleClear} disabled={!canUpdateRoles}>
          <Trans i18nKey="role-picker-drawer.clear-all">Clear all</Trans>
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!hasChanges && canUpdateRoles}>
          <Trans i18nKey="role-picker-drawer.save">Save</Trans>
        </Button>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
  }),
  section: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  roleList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  roleCard: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.primary,
  }),
  roleInfo: css({
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    minWidth: 0,
  }),
  actions: css({
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    paddingTop: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});
