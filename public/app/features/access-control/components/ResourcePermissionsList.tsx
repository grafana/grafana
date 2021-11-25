import React from 'react';
import { Icon, Select, Tooltip } from '@grafana/ui';
import { ResourcePermission } from '../types';

interface Props {
  title: string;
  items: ResourcePermission[];
  permissions: string[];
  canRemove: boolean;
  onRemove: (item: ResourcePermission) => void;
  onChange: (resourcePermission: ResourcePermission, permission: string) => void;
}

export const ResourcePermissionTable = ({ title, items, permissions, canRemove, onRemove, onChange }: Props) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h5>{title}</h5>
      <table className="filter-table gf-form-group">
        <tbody>
          {items.map((item, index) => (
            <TableRow
              key={`${index}-${item.userId}`}
              item={item}
              onRemove={onRemove}
              onChange={onChange}
              canRemove={canRemove}
              permissions={permissions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface TableRowProps {
  item: ResourcePermission;
  permissions: string[];
  canRemove: boolean;
  onRemove: (item: ResourcePermission) => void;
  onChange: (item: ResourcePermission, permission: string) => void;
}

const TableRow = ({ item, permissions, canRemove, onRemove, onChange }: TableRowProps) => {
  const renderAvatar = () => {
    if (item.teamId) {
      return <img className="filter-table__avatar" src={item.teamAvatarUrl} alt={`Avatar for team ${item.teamId}`} />;
    } else if (item.userId) {
      return <img className="filter-table__avatar" src={item.userAvatarUrl} alt={`Avatar for user ${item.userId}`} />;
    }
    return <Icon size="xl" name="shield" />;
  };

  const renderDescription = () => {
    if (item.userId) {
      return <span key="name">{item.userLogin} </span>;
    } else if (item.teamId) {
      return <span key="name">{item.team} </span>;
    } else if (item.builtInRole) {
      return <span key="name">{item.builtInRole} </span>;
    }
    return <span key="name" />;
  };

  return (
    <tr>
      <td style={{ width: '1%' }}>{renderAvatar()}</td>
      <td style={{ width: '90%' }}>{renderDescription()}</td>
      <td />
      <td className="query-keyword">Can</td>
      <td>
        <div className="gf-form">
          <Select
            className="width-20"
            menuShouldPortal
            onChange={(p) => onChange(item, p.value!)}
            value={permissions.find((p) => p === item.permission)}
            options={permissions.map((p) => ({ value: p, label: p }))}
          />
        </div>
      </td>
      <td>
        <Tooltip content={formatActions(item.actions)}>
          <Icon name="info-circle" />
        </Tooltip>
      </td>
      <td>
        {item.managed ? (
          <button className="btn btn-danger btn-small" disabled={!canRemove} onClick={() => onRemove(item)}>
            <Icon name="times" size="sm" />
          </button>
        ) : (
          <button className="btn btn-inverse btn-small">
            <Tooltip content="None managed permission">
              <Icon name="lock" size="sm" />
            </Tooltip>
          </button>
        )}
      </td>
    </tr>
  );
};

const formatActions = (actions: string[]): string => {
  return actions
    .filter((a, i, arr) => arr.indexOf(a) === i)
    .sort()
    .join(' ');
};
