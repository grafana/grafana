import React from 'react';
import { ResourcePermission } from './types';
import { PermissionListItem } from './PermissionListItem';

interface Props {
  title: string;
  items: ResourcePermission[];
  permissionLevels: string[];
  canRemove: boolean;
  onRemove: (item: ResourcePermission) => void;
  onChange: (resourcePermission: ResourcePermission, permission: string) => void;
}

export const PermissionList = ({ title, items, permissionLevels, canRemove, onRemove, onChange }: Props) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h5>{title}</h5>
      <table className="filter-table gf-form-group">
        <tbody>
          {items.map((item, index) => (
            <PermissionListItem
              item={item}
              onRemove={onRemove}
              onChange={onChange}
              canRemove={canRemove}
              key={`${index}-${item.userId}`}
              permissionLevels={permissionLevels}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
