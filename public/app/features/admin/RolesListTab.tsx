import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import {
  Button,
  CellProps,
  Column,
  DeleteButton,
  FilterInput,
  InteractiveTable,
  RadioButtonGroup,
  Stack,
  Tag,
  Text,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useDeleteRoleMutation, useListRolesQuery } from 'app/api/clients/roles';
import { Role } from 'app/types/accessControl';

type RoleType = 'basic' | 'fixed' | 'custom' | 'plugin';

function getRoleType(role: Role): RoleType {
  const name = role.name || '';
  if (name.startsWith('basic:')) {
    return 'basic';
  }
  if (name.startsWith('fixed:')) {
    return 'fixed';
  }
  if (name.startsWith('plugins:')) {
    return 'plugin';
  }
  return 'custom';
}

function isProvisioned(role: Role): boolean {
  return (role.name || '').startsWith('managed:');
}

/** Roles that can be opened in the editor */
function isRoleEditable(role: Role): boolean {
  const roleType = getRoleType(role);
  if (roleType === 'fixed' || roleType === 'plugin' || isProvisioned(role)) {
    return false;
  }
  // Grafana Admin and None basic roles are not editable
  const name = role.name || '';
  if (name === 'basic:grafana_admin' || name === 'basic:none') {
    return false;
  }
  return true;
}

const TYPE_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Basic', value: 'basic' },
  { label: 'Fixed', value: 'fixed' },
  { label: 'Custom', value: 'custom' },
  { label: 'Plugin', value: 'plugin' },
];

const TYPE_BADGE_COLOR_INDEX: Record<RoleType, number> = {
  basic: 1,   // blue
  fixed: 4,   // green
  custom: 6,  // purple
  plugin: 8,  // orange
};

export const RolesListTab = () => {
  const { data: roles = [], isLoading } = useListRolesQuery({ includeHidden: true });
  const [deleteRole] = useDeleteRoleMutation();
  const styles = useStyles2(getStyles);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filteredRoles = useMemo(() => {
    const TYPE_ORDER: Record<RoleType, number> = { basic: 0, custom: 1, fixed: 2, plugin: 3 };
    return roles
      .filter((role) => {
        const matchesSearch =
          !searchQuery ||
          (role.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (role.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (role.group || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = !typeFilter || getRoleType(role) === typeFilter;

        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        const typeA = TYPE_ORDER[getRoleType(a)] ?? 9;
        const typeB = TYPE_ORDER[getRoleType(b)] ?? 9;
        if (typeA !== typeB) {
          return typeA - typeB;
        }
        const groupCmp = (a.group || '').localeCompare(b.group || '');
        if (groupCmp !== 0) {
          return groupCmp;
        }
        return (a.displayName || '').localeCompare(b.displayName || '');
      });
  }, [roles, searchQuery, typeFilter]);

  const columns: Array<Column<Role>> = useMemo(
    () => [
      {
        id: 'group',
        header: t('admin.roles-list.column-group', 'Group'),
        cell: ({ row: { original } }: CellProps<Role, unknown>) => (
          <Text color="secondary" variant="bodySmall">{original.group || '—'}</Text>
        ),
        sortType: (a, b) => (a.original.group || '').localeCompare(b.original.group || ''),
      },
      {
        id: 'displayName',
        header: t('admin.roles-list.column-name', 'Name'),
        cell: ({ row: { original } }: CellProps<Role, unknown>) => {
          const baseName = original.displayName || original.name || '';
          const roleType = getRoleType(original);
          // Fixed roles share generic names like "Reader" — qualify with group
          const displayName =
            roleType === 'fixed' && original.group ? `${original.group}: ${baseName}` : baseName;
          return original.description ? (
            <Tooltip content={original.description} placement="top-start">
              <span><Text weight="medium">{displayName}</Text></span>
            </Tooltip>
          ) : (
            <Text weight="medium">{displayName}</Text>
          );
        },
        sortType: (a, b) => {
          const getDisplayName = (role: Role) => {
            const baseName = role.displayName || role.name || '';
            const roleType = getRoleType(role);
            return roleType === 'fixed' && role.group ? `${role.group}: ${baseName}` : baseName;
          };
          return getDisplayName(a.original).localeCompare(getDisplayName(b.original));
        },
      },
      {
        id: 'role',
        header: t('admin.roles-list.column-role', 'Role'),
        cell: ({ row: { original } }: CellProps<Role, unknown>) => (
          <span className={styles.roleId}>{original.name || '—'}</span>
        ),
        sortType: (a, b) => (a.original.name || '').localeCompare(b.original.name || ''),
      },
      {
        id: 'type',
        header: t('admin.roles-list.column-type', 'Type'),
        cell: ({ row: { original } }: CellProps<Role, unknown>) => {
          const roleType = getRoleType(original);
          const label = isProvisioned(original) ? 'Provisioned' : roleType.charAt(0).toUpperCase() + roleType.slice(1);
          return <Tag name={label} colorIndex={TYPE_BADGE_COLOR_INDEX[roleType]} />;
        },
      },
      {
        id: 'actions',
        header: '',
        disableGrow: true,
        cell: ({ row: { original } }: CellProps<Role, unknown>) => {
          const editable = isRoleEditable(original);
          const roleType = getRoleType(original);
          return (
            <Stack direction="row" justifyContent="flex-end" gap={2}>
              <Button
                icon={editable ? 'pen' : 'eye'}
                size="sm"
                variant="secondary"
                onClick={() => locationService.push(`/admin/roles/edit/${original.uid}`)}
                tooltip={editable ? t('admin.roles-list.edit-button', 'Edit') : t('admin.roles-list.view-button', 'View')}
                aria-label={
                  editable
                    ? t('admin.roles-list.edit-aria', 'Edit role {{roleName}}', {
                        roleName: original.displayName || original.name || '',
                      })
                    : t('admin.roles-list.view-aria', 'View role {{roleName}}', {
                        roleName: original.displayName || original.name || '',
                      })
                }
              />
              {editable && roleType === 'custom' && (
                <DeleteButton
                  size="sm"
                  aria-label={t('admin.roles-list.delete-aria', 'Delete role {{roleName}}', {
                    roleName: original.displayName || original.name || '',
                  })}
                  onConfirm={() => {
                    if (original.uid) {
                      deleteRole({ roleUid: original.uid, force: true });
                    }
                  }}
                />
              )}
            </Stack>
          );
        },
      },
    ],
    [deleteRole, styles.roleId]
  );

  return (
    <Page.Contents>
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={2} justifyContent="space-between" alignItems="center">
          <Stack direction="row" gap={2} alignItems="center">
            <FilterInput
              placeholder={t('admin.roles-list.search-placeholder', 'Search roles by name or group')}
              value={searchQuery}
              onChange={setSearchQuery}
              width={40}
            />
            <RadioButtonGroup options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} size="sm" />
            {!isLoading && (
              <Text color="secondary" variant="bodySmall">
                {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
                {filteredRoles.length} {filteredRoles.length === 1 ? 'role' : 'roles'}{typeFilter ? ` (${typeFilter})` : ''}
              </Text>
            )}
          </Stack>
          <Button icon="plus" onClick={() => locationService.push('/admin/roles/edit/new')}>
            {t('admin.roles-list.create-button', 'New custom role')}
          </Button>
        </Stack>

        {isLoading ? (
          <p>{t('admin.roles-list.loading', 'Loading roles...')}</p>
        ) : filteredRoles.length === 0 ? (
          <Text color="secondary" italic>
            {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
            No {typeFilter || ''} roles{searchQuery ? ` matching "${searchQuery}"` : ' found'}
          </Text>
        ) : (
          <InteractiveTable columns={columns} data={filteredRoles} getRowId={(role) => role.uid || role.name || ''} />
        )}
      </Stack>

    </Page.Contents>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  roleId: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    wordBreak: 'break-all' as const,
  }),
});
