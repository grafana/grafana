import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Permission, RoleDto } from '@grafana/api-clients/rtkq/legacy';
import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, FilterInput, Icon, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { fetchRoleDetail, InheritedRoleInfo } from 'app/core/components/RolePicker/hooks';
import { Role } from 'app/types/accessControl';

interface Props {
  basicRole: OrgRole;
  userRoles: Role[];
  inheritedRoles: Map<string, InheritedRoleInfo>;
  orphanPermissions: Permission[];
  isLoading: boolean;
}

export const PermissionsBreakdown = ({
  basicRole,
  userRoles,
  inheritedRoles,
  orphanPermissions,
  isLoading,
}: Props) => {
  const styles = useStyles2(getStyles);
  const [expandedRoleUid, setExpandedRoleUid] = useState<string | null>(null);
  const [roleDetails, setRoleDetails] = useState<Record<string, RoleDto>>({});
  const [loadingUid, setLoadingUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const directRoles = userRoles.filter((r) => !inheritedRoles.has(r.uid));
  const inheritedList = Array.from(inheritedRoles.values());

  // Pre-fetch permission counts for all roles on mount
  const allRoleUids = useMemo(() => {
    const uids = new Set<string>();
    for (const r of directRoles) {
      uids.add(r.uid);
    }
    for (const info of inheritedList) {
      uids.add(info.role.uid);
    }
    return Array.from(uids);
  }, [directRoles, inheritedList]);

  useEffect(() => {
    let cancelled = false;
    const prefetch = async () => {
      for (const uid of allRoleUids) {
        if (cancelled) {
          break;
        }
        if (!roleDetails[uid]) {
          try {
            const detail = await fetchRoleDetail(uid);
            if (!cancelled) {
              setRoleDetails((prev) => ({ ...prev, [uid]: detail }));
            }
          } catch {
            // Skip roles that fail to fetch
          }
        }
      }
    };
    prefetch();
    return () => {
      cancelled = true;
    };
    // Only run when the list of role UIDs changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRoleUids.join(',')]);

  // Filter roles by search query (matches role name, group, or permission actions)
  const query = searchQuery.toLowerCase();
  const filteredDirectRoles = useMemo(
    () =>
      directRoles.filter((r) => {
        if (!query) {
          return true;
        }
        return (
          (r.displayName || r.name || '').toLowerCase().includes(query) ||
          (r.group || '').toLowerCase().includes(query) ||
          roleDetails[r.uid]?.permissions?.some((p) => (p.action || '').toLowerCase().includes(query))
        );
      }),
    [directRoles, query, roleDetails]
  );

  const filteredInheritedList = useMemo(
    () =>
      inheritedList.filter((info) => {
        if (!query) {
          return true;
        }
        const r = info.role;
        return (
          (r.displayName || r.name || '').toLowerCase().includes(query) ||
          (r.group || '').toLowerCase().includes(query) ||
          info.sources.some((s) => s.toLowerCase().includes(query)) ||
          roleDetails[r.uid]?.permissions?.some((p) => (p.action || '').toLowerCase().includes(query))
        );
      }),
    [inheritedList, query, roleDetails]
  );

  const filteredOrphanPermissions = useMemo(
    () =>
      query
        ? orphanPermissions.filter(
            (p) =>
              (p.action || '').toLowerCase().includes(query) || (p.scope || '').toLowerCase().includes(query)
          )
        : orphanPermissions,
    [orphanPermissions, query]
  );

  const handleToggle = useCallback(
    async (uid: string) => {
      if (expandedRoleUid === uid) {
        setExpandedRoleUid(null);
        return;
      }
      setExpandedRoleUid(uid);
      if (!roleDetails[uid]) {
        setLoadingUid(uid);
        try {
          const detail = await fetchRoleDetail(uid);
          setRoleDetails((prev) => ({ ...prev, [uid]: detail }));
        } catch (e) {
          console.error('Error fetching role detail', e);
        } finally {
          setLoadingUid(null);
        }
      }
    },
    [expandedRoleUid, roleDetails]
  );

  const renderPermissions = (uid: string) => {
    if (loadingUid === uid) {
      return (
        <div className={styles.permList}>
          <Spinner />
        </div>
      );
    }
    const detail = roleDetails[uid];
    const perms = (detail?.permissions || []).slice().sort((a, b) => (a.action || '').localeCompare(b.action || ''));
    if (perms.length === 0) {
      return (
        <div className={styles.permList}>
          <Text color="secondary" italic>
            {t('role-picker-drawer.no-permissions', 'No permissions')}
          </Text>
        </div>
      );
    }
    return (
      <div className={styles.permList}>
        <div className={styles.permTable}>
          <div className={styles.permTableHeader}>
            <Text color="secondary" variant="bodySmall" weight="medium">
              Action
            </Text>
            <Text color="secondary" variant="bodySmall" weight="medium">
              Scope
            </Text>
          </div>
          {perms.map((p, i) => (
            <div key={i} className={styles.permTableRow}>
              <code className={styles.action}>{p.action}</code>
              <Text color="secondary" variant="bodySmall">
                {p.scope || '*'}
              </Text>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRoleRow = (role: Role, source?: string) => {
    const isExpanded = expandedRoleUid === role.uid;
    const detail = roleDetails[role.uid];
    const permCount = detail?.permissions?.length;

    return (
      <div key={role.uid} className={styles.roleItem}>
        <button className={styles.roleButton} onClick={() => handleToggle(role.uid)}>
          <Icon name={isExpanded ? 'angle-down' : 'angle-right'} size="md" />
          <span className={styles.roleName}>
            <Text weight="medium">{role.displayName || role.name}</Text>
          </span>
          {role.group && <Badge text={role.group} color="blue" />}
          {source && <Badge text={source} color="purple" />}
          <Text color="secondary" variant="bodySmall">
            {permCount !== undefined ? permCount : '...'}
          </Text>
        </button>
        {isExpanded && renderPermissions(role.uid)}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Stack direction="row" gap={1} alignItems="center">
          <Spinner />
          <Text color="secondary">
            {t('role-picker-drawer.computing-inheritance', 'Computing inherited permissions...')}
          </Text>
        </Stack>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <FilterInput
        placeholder={t('role-picker-drawer.search-placeholder', 'Search roles or permissions...')}
        value={searchQuery}
        onChange={setSearchQuery}
      />

      {/* Directly assigned */}
      <div className={styles.section}>
        <Text element="h4" weight="medium">
          {t('role-picker-drawer.directly-assigned', 'Directly assigned')}
        </Text>
        {filteredDirectRoles.length > 0 ? (
          <div className={styles.roleList}>
            {filteredDirectRoles.map((role) => renderRoleRow(role))}
          </div>
        ) : (
          <Text color="secondary" italic>
            {query
              ? t('role-picker-drawer.no-search-results', 'No matching roles')
              : t('role-picker-drawer.no-direct-roles', 'No additional roles assigned')}
          </Text>
        )}
      </div>

      {/* Inherited from basic role */}
      {(filteredInheritedList.length > 0 || (!query && inheritedList.length > 0)) && (
        <div className={styles.section}>
          <Text element="h4" weight="medium">
            {t('role-picker-drawer.inherited-heading', 'Inherited from {{role}}', {
              role: basicRole,
            })}
          </Text>
          {!query && (
            <Text color="secondary" variant="bodySmall">
              {t(
                'role-picker-drawer.inherited-desc',
                'Automatically included with the {{role}} basic role. Expand to see permissions.',
                { role: basicRole }
              )}
            </Text>
          )}
          {filteredInheritedList.length > 0 ? (
            <div className={styles.roleList}>
              {filteredInheritedList.map((info) =>
                renderRoleRow(info.role, info.sources.join(', '))
              )}
            </div>
          ) : (
            <Text color="secondary" italic>
              {t('role-picker-drawer.no-search-results', 'No matching roles')}
            </Text>
          )}
        </div>
      )}

      {/* Orphan permissions */}
      {filteredOrphanPermissions.length > 0 && (
        <div className={styles.section}>
          <Text element="h4" weight="medium">
            {t('role-picker-drawer.other-permissions', 'Other permissions')}
          </Text>
          <div className={styles.permList}>
            <div className={styles.permTable}>
              <div className={styles.permTableHeader}>
                <Text color="secondary" variant="bodySmall" weight="medium">
                  Action
                </Text>
                <Text color="secondary" variant="bodySmall" weight="medium">
                  Scope
                </Text>
              </div>
              {filteredOrphanPermissions.map((p, i) => (
                <div key={i} className={styles.permTableRow}>
                  <code className={styles.action}>{p.action}</code>
                  <Text color="secondary" variant="bodySmall">
                    {p.scope || '*'}
                  </Text>
                </div>
              ))}
            </div>
          </div>
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
    padding: theme.spacing(1, 0),
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
  roleItem: css({
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    overflow: 'hidden',
  }),
  roleButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(1, 1.5),
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  roleName: css({
    flex: '0 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  permList: css({
    padding: theme.spacing(1, 1.5, 1.5, 3),
    backgroundColor: theme.colors.background.secondary,
    borderTop: `1px solid ${theme.colors.border.weak}`,
    maxHeight: 250,
    overflowY: 'auto',
  }),
  permTable: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: `${theme.spacing(0.25)} ${theme.spacing(2)}`,
  }),
  permTableHeader: css({
    display: 'contents',
    '& > *': {
      paddingBottom: theme.spacing(0.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
  }),
  permTableRow: css({
    display: 'contents',
  }),
  action: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
