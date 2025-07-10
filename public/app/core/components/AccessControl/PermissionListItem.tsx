import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, Icon, Select, Tooltip, useStyles2 } from '@grafana/ui';

import { ResourcePermission } from './types';

interface Props {
  item: ResourcePermission;
  permissionLevels: string[];
  canSet: boolean;
  onRemove: (item: ResourcePermission) => void;
  onChange: (item: ResourcePermission, permission: string) => void;
}

export const PermissionListItem = ({ item, permissionLevels, canSet, onRemove, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <tr>
      <td>{getAvatar(item)}</td>
      <td>{getDescription(item)}</td>
      <td>
        {item.isInherited && (
          <em className={styles.inherited}>
            <Trans i18nKey="access-control.permission-list-item.inherited">Inherited from folder</Trans>
          </em>
        )}
      </td>
      <td>
        <Select
          disabled={!canSet || !item.isManaged}
          onChange={(p) => onChange(item, p.value!)}
          value={permissionLevels.find((p) => p === item.permission)}
          options={permissionLevels.map((p) => ({ value: p, label: p }))}
        />
      </td>
      <td>
        {item.warning ? (
          <Tooltip
            content={
              <>
                <Box marginBottom={1}>{item.warning}</Box>
                {getPermissionInfo(item)}
              </>
            }
          >
            <Icon name="exclamation-triangle" className={styles.warning} />
          </Tooltip>
        ) : (
          <Tooltip content={getPermissionInfo(item)}>
            <Icon name="info-circle" />
          </Tooltip>
        )}
      </td>
      <td>
        {item.isManaged ? (
          <Button
            size="sm"
            icon="times"
            variant="destructive"
            disabled={!canSet}
            onClick={() => onRemove(item)}
            aria-label={t(
              'access-control.permission-list-item.remove-aria-label',
              'Remove permission for {{identifier}}',
              {
                identifier: getName(item),
              }
            )}
          />
        ) : (
          <Tooltip
            content={
              item.isInherited
                ? t('access-control.permission-list-item.tooltip-inherited-permission', 'Inherited permission')
                : t('access-control.permission-list-item.tooltip-provisioned-permission', 'Provisioned permission')
            }
          >
            <Button
              size="sm"
              icon="lock"
              aria-label={t('access-control.permission-list-item.locked-aria-label', 'Locked permission indicator')}
            />
          </Tooltip>
        )}
      </td>
    </tr>
  );
};

const getAvatar = (item: ResourcePermission) => {
  if (item.teamId) {
    return <img className="filter-table__avatar" src={item.teamAvatarUrl} alt={`Avatar for team ${item.teamId}`} />;
  } else if (item.userId) {
    return <img className="filter-table__avatar" src={item.userAvatarUrl} alt={`Avatar for user ${item.userId}`} />;
  }
  return <Icon size="xl" name="shield" />;
};

const getName = (item: ResourcePermission) => {
  if (item.userId) {
    return item.userLogin;
  }
  if (item.teamId) {
    return item.team;
  }
  return item.builtInRole;
};

const getDescription = (item: ResourcePermission) => {
  if (item.userId) {
    return <span key="name">{item.userLogin} </span>;
  } else if (item.teamId) {
    return <span key="name">{item.team} </span>;
  } else if (item.builtInRole) {
    return <span key="name">{item.builtInRole} </span>;
  }
  return <span key="name" />;
};

const getPermissionInfo = (p: ResourcePermission) => `Actions: ${[...new Set(p.actions)].sort().join(' ')}`;

const getStyles = (theme: GrafanaTheme2) => ({
  warning: css({
    color: theme.colors.warning.main,
  }),
  inherited: css({
    color: theme.colors.text.secondary,
    flexWrap: 'nowrap',
  }),
});
