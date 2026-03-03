import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { Permission, RoleDto } from '@grafana/api-clients/rtkq/legacy';
import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Tooltip, useStyles2 } from '@grafana/ui';

import { fetchRoleDetail } from './hooks';

interface PermissionsListProps {
  roleUid: string;
}

/**
 * Formats a permission into a single human-readable line.
 * "alert.instances:read" + scope "*" → "Read alert instances"
 * "folders:read" + scope "folders:uid:general" → "Read folders · General folder"
 */
function formatPermission(perm: Permission): string {
  const action = perm.action || '';
  const colonIdx = action.lastIndexOf(':');
  const domain = colonIdx > 0 ? action.substring(0, colonIdx) : action;
  const verb = colonIdx > 0 ? action.substring(colonIdx + 1) : action;

  // Clean up domain: remove grafana- prefix, replace separators with spaces
  const cleanDomain = domain
    .replace(/^grafana-/, '')
    .replace(/[.\-_]/g, ' ')
    .trim();

  // Capitalize verb
  const capVerb = verb.charAt(0).toUpperCase() + verb.slice(1);

  let line = `${capVerb} ${cleanDomain}`;

  // Only show scope when it's specific (not wildcard)
  const scope = perm.scope || '';
  if (scope && scope !== '' && scope !== '*' && !scope.endsWith(':*')) {
    let cleanScope = scope;
    if (scope === 'folders:uid:general') {
      cleanScope = 'root level';
    } else if (scope.startsWith('folders:uid:')) {
      cleanScope = scope.replace('folders:uid:', '');
      cleanScope = cleanScope.charAt(0).toUpperCase() + cleanScope.slice(1) + ' folder';
    } else if (scope === 'datasources:uid:grafana') {
      cleanScope = 'built-in Grafana datasource';
    } else if (scope.startsWith('datasources:uid:')) {
      cleanScope = scope.replace('datasources:uid:', '') + ' datasource';
    }
    line += `: ${cleanScope}`;
  }

  return line;
}

export const PermissionsList = ({ roleUid }: PermissionsListProps) => {
  const styles = useStyles2(getPermissionsStyles);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchRoleDetail(roleUid).then((detail: RoleDto) => {
      if (!cancelled) {
        setPermissions(detail.permissions || []);
        setIsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [roleUid]);

  const onCopyJson = useCallback(() => {
    const json = JSON.stringify(
      permissions.map((p) => ({ action: p.action, scope: p.scope || '' })),
      null,
      2
    );
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [permissions]);

  if (isLoading) {
    return <div className={styles.container}><span className={styles.loading}>Loading...</span></div>;
  }

  if (!permissions.length) {
    return <div className={styles.container}><span className={styles.empty}>No permissions</span></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.count}>{permissions.length} {permissions.length === 1 ? 'permission' : 'permissions'}</span>
        <Tooltip content={copied ? 'Copied!' : 'Copy as JSON'}>
          <IconButton
            name={copied ? 'check' : 'copy'}
            size="sm"
            onClick={onCopyJson}
            aria-label="Copy permissions as JSON"
          />
        </Tooltip>
      </div>
      <div className={styles.list}>
        {permissions
          .sort((a, b) => (a.action || '').localeCompare(b.action || ''))
          .map((perm, i) => (
            <div key={i} className={styles.permissionLine}>
              {formatPermission(perm)}
            </div>
          ))}
      </div>
    </div>
  );
};

const getPermissionsStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(1, 1.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
    maxHeight: '200px',
    overflowY: 'auto' as const,
  }),
  header: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(0.5),
  }),
  count: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  loading: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    fontStyle: 'italic',
  }),
  empty: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
  }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  }),
  permissionLine: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    lineHeight: 1.5,
    padding: theme.spacing(0, 0, 0, 0.5),
  }),
});
