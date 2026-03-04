import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
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

const TYPE_BADGE_COLORS: Record<RoleType, 'blue' | 'green' | 'purple' | 'orange'> = {
  basic: 'blue',
  fixed: 'green',
  custom: 'purple',
  plugin: 'orange',
};

interface RolesListTabProps {
  onEditRole: (role: Role) => void;
  onCreateRole: () => void;
}

export const RolesListTab = ({ onEditRole, onCreateRole }: RolesListTabProps) => {
  const styles = useStyles2(getStyles);
  const { data: roles = [], isLoading } = useListRolesQuery({ includeHidden: true });
  const [deleteRole] = useDeleteRoleMutation();

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
        id: 'displayName',
        header: t('admin.roles-list.column-name', 'Name'),
        cell: ({ row: { original } }: CellProps<Role, unknown>) => {
          const baseName = original.displayName || original.name || '';
          const roleType = getRoleType(original);
          // Fixed roles share generic names like "Reader" — qualify with group
          const displayName =
            roleType === 'fixed' && original.group ? `${original.group}: ${baseName}` : baseName;
          return (
            <button
              className={styles.roleNameButton}
              onClick={() => onEditRole(original)}
            >
              {displayName}
            </button>
          );
        },
        sortType: 'string',
      },
      {
        id: 'type',
        header: t('admin.roles-list.column-type', 'Type'),
        cell: ({ row: { original } }: CellProps<Role, unknown>) => {
          const roleType = getRoleType(original);
          const label = isProvisioned(original) ? 'Provisioned' : roleType.charAt(0).toUpperCase() + roleType.slice(1);
          return <Tag name={label} colorIndex={Object.keys(TYPE_BADGE_COLORS).indexOf(roleType)} />;
        },
      },
      {
        id: 'group',
        header: t('admin.roles-list.column-group', 'Group'),
        cell: ({ row: { original } }: CellProps<Role, unknown>) => original.group || '—',
        sortType: 'string',
      },
      {
        id: 'actions',
        header: '',
        disableGrow: true,
        cell: ({ row: { original } }: CellProps<Role, unknown>) => {
          if (!isRoleEditable(original)) {
            return null;
          }

          const roleType = getRoleType(original);
          return (
            <Stack direction="row" justifyContent="flex-end" gap={2}>
              <Button
                icon="pen"
                size="sm"
                variant="secondary"
                onClick={() => onEditRole(original)}
                tooltip={t('admin.roles-list.edit-button', 'Edit')}
                aria-label={t('admin.roles-list.edit-aria', 'Edit role {{roleName}}', {
                  roleName: original.displayName || original.name || '',
                })}
              />
              {roleType === 'custom' && (
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
    [onEditRole, deleteRole, styles.roleNameButton]
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
          </Stack>
          <Button icon="plus" onClick={onCreateRole}>
            {t('admin.roles-list.create-button', 'New custom role')}
          </Button>
        </Stack>

        {isLoading ? (
          <p>{t('admin.roles-list.loading', 'Loading roles...')}</p>
        ) : (
          <InteractiveTable columns={columns} data={filteredRoles} getRowId={(role) => role.uid || role.name || ''} />
        )}
      </Stack>

    </Page.Contents>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  roleNameButton: css({
    background: 'none',
    border: 'none',
    color: theme.colors.text.link,
    cursor: 'pointer',
    padding: 0,
    textAlign: 'left' as const,
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
});
