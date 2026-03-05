import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, OrgRole, SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, FilterInput, Icon, IconButton, RadioButtonGroup, Select, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { Role } from 'app/types/accessControl';

interface TeamRole {
  role: Role;
  teamName: string;
  teamUid: string;
}

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
  basicRole?: OrgRole;
  appliedRoles: Role[];
  roleOptions: Role[];
  teamRoles?: TeamRole[];
  basicRoleDisabled?: boolean;
  disabledMessage?: string;
  canUpdateRoles: boolean;
  /** Drawer mode: called when user clicks Save */
  onUpdate?: (newRoles: Role[], newBasicRole?: OrgRole) => void;
  /** Inline/form mode: called on every change (no save button shown) */
  onChange?: (newRoles: Role[], newBasicRole?: OrgRole) => void;
  /** URL linking to the advanced permissions view for this entity */
  advancedViewUrl?: string;
}

export type { TeamRole };

const sortRoles = (roles: Role[]) =>
  [...roles].sort((a, b) => {
    const groupCmp = (a.group || '').localeCompare(b.group || '');
    if (groupCmp !== 0) {
      return groupCmp;
    }
    return (a.displayName || a.name).localeCompare(b.displayName || b.name);
  });

export const AssignRoles = ({
  basicRole,
  appliedRoles,
  roleOptions,
  teamRoles = [],
  basicRoleDisabled,
  disabledMessage,
  canUpdateRoles,
  onUpdate,
  onChange,
  advancedViewUrl,
}: Props) => {
  const styles = useStyles2(getStyles);
  const isInlineMode = !!onChange;
  const [selectedBasicRole, setSelectedBasicRole] = useState<OrgRole | undefined>(basicRole);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(sortRoles(appliedRoles));
  const [searchQuery, setSearchQuery] = useState('');

  // Sync state when props update (e.g. data loads after initial mount)
  useEffect(() => {
    setSelectedRoles(sortRoles(appliedRoles));
  }, [appliedRoles]);

  useEffect(() => {
    setSelectedBasicRole(basicRole);
  }, [basicRole]);

  // In inline mode, notify parent on every change
  const notifyChange = (roles: Role[], basic?: OrgRole) => {
    if (onChange) {
      onChange(roles, basic);
    }
  };

  // Filter assigned roles by search
  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) {
      return selectedRoles;
    }
    const q = searchQuery.toLowerCase();
    return selectedRoles.filter(
      (r) =>
        (r.displayName || r.name).toLowerCase().includes(q) ||
        (r.group || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
    );
  }, [selectedRoles, searchQuery]);

  // Filter team roles by search
  const filteredTeamRoles = useMemo(() => {
    if (!searchQuery.trim()) {
      return teamRoles;
    }
    const q = searchQuery.toLowerCase();
    return teamRoles.filter(
      (tr) =>
        (tr.role.displayName || tr.role.name).toLowerCase().includes(q) ||
        (tr.role.group || '').toLowerCase().includes(q) ||
        tr.teamName.toLowerCase().includes(q)
    );
  }, [teamRoles, searchQuery]);

  // Build grouped options for the Add Role select, excluding already-selected
  const addRoleOptions = useMemo(() => {
    const selectedUids = new Set(selectedRoles.map((r) => r.uid));

    const toOption = (r: Role): SelectableValue<string> => ({
      label: r.displayName || r.name,
      value: r.uid,
      description: [r.group, r.description].filter(Boolean).join(' — ') || undefined,
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
      const next = sortRoles([...selectedRoles, role]);
      setSelectedRoles(next);
      notifyChange(next, selectedBasicRole);
    }
  };

  const handleRemoveRole = (uid: string) => {
    const next = selectedRoles.filter((r) => r.uid !== uid);
    setSelectedRoles(next);
    notifyChange(next, selectedBasicRole);
  };

  const handleBasicRoleChange = (newRole: OrgRole) => {
    setSelectedBasicRole(newRole);
    notifyChange(selectedRoles, newRole);
  };

  const handleClear = () => {
    const kept = selectedRoles.filter((r) => r.mapped);
    setSelectedRoles(kept);
    notifyChange(kept, selectedBasicRole);
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(selectedRoles, selectedBasicRole);
    }
  };

  const hasChanges =
    selectedBasicRole !== basicRole ||
    selectedRoles.length !== appliedRoles.length ||
    selectedRoles.some((r) => !appliedRoles.find((a) => a.uid === r.uid));

  const totalRoles = selectedRoles.length + teamRoles.length;

  const renderRoleCard = (role: Role, source?: { type: 'team' | 'mapped'; label: string; teamUid?: string }) => (
    <Tooltip
      content={
        <div>
          <div><strong>{role.displayName || role.name}</strong></div>
          {role.description && <div>{role.description}</div>}
          {role.group && <div><em>{role.group}</em></div>}
          {source && <div>Source: {source.label}</div>}
        </div>
      }
      placement="left"
      key={`${role.uid}-${source?.label || 'direct'}`}
    >
      <div className={styles.roleCard}>
        <div className={styles.roleInfo}>
          <Text>{role.displayName || role.name}</Text>
          <Stack direction="row" gap={0.5} alignItems="center">
            {role.group && (
              <Text color="secondary" variant="bodySmall">
                {role.group}
              </Text>
            )}
            {source?.type === 'team' && (
              <Text color="secondary" variant="bodySmall">
                {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
                <Icon name="users-alt" size="xs" /> {source.label}
              </Text>
            )}
            {source?.type === 'mapped' && (
              <Text color="secondary" variant="bodySmall">
                {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
                <Icon name="lock" size="xs" /> IdP
              </Text>
            )}
          </Stack>
        </div>
        {!source && !role.mapped && canUpdateRoles && (
          <IconButton
            name="trash-alt"
            size="sm"
            onClick={() => handleRemoveRole(role.uid)}
            aria-label={t('role-picker-drawer.remove-role', 'Remove {{role}}', {
              role: role.displayName || role.name,
            })}
          />
        )}
        {role.mapped && !source && (
          <Tooltip content={t('role-picker-drawer.mapped-tooltip', 'Synced from identity provider')}>
            <IconButton name="lock" size="sm" aria-label="Mapped role" />
          </Tooltip>
        )}
      </div>
    </Tooltip>
  );

  return (
    <div className={styles.container}>
      {/* Basic role selector — only shown when entity has a basic role */}
      {basicRole !== undefined && (
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
            onChange={handleBasicRoleChange}
            disabled={basicRoleDisabled}
            size="md"
          />
        </div>
      )}

      {/* Assigned roles */}
      <div className={styles.section}>
        <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
          <Text weight="medium">
            {t('role-picker-drawer.assigned-roles-label', 'Assigned roles')}
            {totalRoles > 0 && (
              <Text color="secondary" variant="bodySmall"> ({totalRoles})</Text>
            )}
          </Text>
        </Stack>

        {/* Search filter */}
        {totalRoles > 3 && (
          <FilterInput
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="Search assigned roles..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        )}

        {/* Direct roles */}
        {filteredRoles.length > 0 && (
          <div className={styles.roleList}>
            {filteredRoles.map((role) =>
              renderRoleCard(role, role.mapped ? { type: 'mapped', label: 'Identity Provider' } : undefined)
            )}
          </div>
        )}

        {/* Team-inherited roles */}
        {filteredTeamRoles.length > 0 && (
          <div className={styles.roleList}>
            {filteredTeamRoles.map((tr) =>
              renderRoleCard(tr.role, { type: 'team', label: tr.teamName, teamUid: tr.teamUid })
            )}
          </div>
        )}

        {totalRoles === 0 && (
          <Text color="secondary" italic>
            {t('role-picker-drawer.no-roles', 'No additional roles assigned')}
          </Text>
        )}

        {totalRoles > 0 && filteredRoles.length === 0 && filteredTeamRoles.length === 0 && searchQuery && (
          <Text color="secondary" italic>
            {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
            No roles matching &quot;{searchQuery}&quot;
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

      {/* Actions — only in drawer mode (onUpdate), hidden in inline/form mode (onChange) */}
      {!isInlineMode && (
        <div className={styles.actions}>
          <Stack direction="row" gap={1} justifyContent="space-between" grow={1}>
            {advancedViewUrl && (
              <TextLink href={advancedViewUrl} variant="bodySmall">
                {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
                View advanced permissions →
              </TextLink>
            )}
            <Stack direction="row" gap={1}>
              <Button size="sm" fill="text" onClick={handleClear} disabled={!canUpdateRoles}>
                <Trans i18nKey="role-picker-drawer.clear-all">Clear all</Trans>
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!hasChanges && canUpdateRoles}>
                <Trans i18nKey="role-picker-drawer.save">Save</Trans>
              </Button>
            </Stack>
          </Stack>
        </div>
      )}
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
    '&:hover': {
      borderColor: theme.colors.border.medium,
    },
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
