import { css } from '@emotion/css';
import { FC } from 'react';

import { PermissionResourceGroup } from './PermissionResourceGroup';
import { rawToPermissionGroup } from './state/helpers';
import { Permission } from './state/types';

type Props = {
  permissions: Permission[];
  canEdit: boolean;
  onChange: (id: string, status: boolean) => void;
};

export const PermissionResourceGroupList: FC<Props> = ({ permissions, canEdit, onChange }) => {
  const groups = rawToPermissionGroup(permissions);
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        overflow-y: scroll;
        height: calc(100vh - 259px);
        max-height: calc(100vh - 259px);
      `}
    >
      {Object.keys(groups).map((group, i) => {
        const perms = groups[group];
        return (
          <PermissionResourceGroup
            key={`permission_group_${i}`}
            group={group}
            permissions={perms}
            canEdit={canEdit}
            onChange={(name, status) => {
              onChange(name, status);
            }}
          />
        );
      })}
    </div>
  );
};
