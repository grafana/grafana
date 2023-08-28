import React from 'react';

import { Button, Icon, Select, Tooltip } from '@grafana/ui';

import { ResourcePermission } from './types';

interface Props {
  item: ResourcePermission;
  permissionLevels: string[];
  canSet: boolean;
  onRemove: (item: ResourcePermission) => void;
  onChange: (item: ResourcePermission, permission: string) => void;
}

export const PermissionListItem = ({ item, permissionLevels, canSet, onRemove, onChange }: Props) => (
  <tr>
    <td>{getAvatar(item)}</td>
    <td>{getDescription(item)}</td>
    <td>{item.isInherited && <em className="muted no-wrap">Inherited from folder</em>}</td>
    <td>
      <Select
        disabled={!canSet || !item.isManaged}
        onChange={(p) => onChange(item, p.value!)}
        value={permissionLevels.find((p) => p === item.permission)}
        options={permissionLevels.map((p) => ({ value: p, label: p }))}
      />
    </td>
    <td>
      <Tooltip content={getPermissionInfo(item)}>
        <Icon name="info-circle" />
      </Tooltip>
    </td>
    <td>
      {item.isManaged ? (
        <Button
          size="sm"
          icon="times"
          variant="destructive"
          disabled={!canSet}
          onClick={() => onRemove(item)}
          aria-label={`Remove permission for ${getName(item)}`}
        />
      ) : (
        <Tooltip content={item.isInherited ? 'Inherited Permission' : 'Provisioned Permission'}>
          <Button size="sm" icon="lock" />
        </Tooltip>
      )}
    </td>
  </tr>
);

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
