import React from 'react';

import { PermissionListItem } from './PermissionListItem';
import { ResourcePermission } from './types';

interface Props {
  title: string;
  items: ResourcePermission[];
  permissionLevels: string[];
  canSet: boolean;
  onRemove: (item: ResourcePermission) => void;
  onChange: (resourcePermission: ResourcePermission, permission: string) => void;
}

export const PermissionList = ({ title, items, permissionLevels, canSet, onRemove, onChange }: Props) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <table className="filter-table gf-form-group">
        <thead>
          <tr>
            <th style={{ width: '1%' }} />
            <th>{title}</th>
            <th style={{ width: '1%' }} />
            <th>Permission</th>
            <th style={{ width: '1%' }} />
            <th style={{ width: '1%' }} />
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <PermissionListItem
              item={item}
              onRemove={onRemove}
              onChange={onChange}
              canSet={canSet}
              key={`${index}-${item.userId}`}
              permissionLevels={permissionLevels}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
