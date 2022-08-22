import { sortBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { getBackendSrv } from 'app/core/services/backend_srv';

import { AddPermission } from './AddPermission';
import { PermissionList } from './PermissionList';
import { PermissionTarget, ResourcePermission, SetPermission, Description } from './types';

const EMPTY_PERMISSION = '';

const INITIAL_DESCRIPTION: Description = {
  permissions: [],
  assignments: {
    teams: false,
    users: false,
    builtInRoles: false,
  },
};

type ResourceId = string | number;
type Type = 'users' | 'teams' | 'builtInRoles';

export type Props = {
  title?: string;
  buttonLabel?: string;
  addPermissionTitle?: string;
  resource: string;
  resourceId: ResourceId;
  canSetPermissions: boolean;
};

export const Permissions = ({
  title = 'Permissions',
  buttonLabel = 'Add a permission',
  resource,
  resourceId,
  canSetPermissions,
  addPermissionTitle,
}: Props) => {
  const [isAdding, setIsAdding] = useState(false);
  const [items, setItems] = useState<ResourcePermission[]>([]);
  const [desc, setDesc] = useState(INITIAL_DESCRIPTION);

  const fetchItems = useCallback(() => {
    return getPermissions(resource, resourceId).then((r) => setItems(r));
  }, [resource, resourceId]);

  useEffect(() => {
    getDescription(resource).then((r) => {
      setDesc(r);
      return fetchItems();
    });
  }, [resource, resourceId, fetchItems]);

  const onAdd = (state: SetPermission) => {
    let promise: Promise<void> | null = null;
    if (state.target === PermissionTarget.User) {
      promise = setUserPermission(resource, resourceId, state.userId!, state.permission);
    } else if (state.target === PermissionTarget.Team) {
      promise = setTeamPermission(resource, resourceId, state.teamId!, state.permission);
    } else if (state.target === PermissionTarget.BuiltInRole) {
      promise = setBuiltInRolePermission(resource, resourceId, state.builtInRole!, state.permission);
    }

    if (promise !== null) {
      promise.then(fetchItems);
    }
  };

  const onRemove = (item: ResourcePermission) => {
    let promise: Promise<void> | null = null;
    if (item.userId) {
      promise = setUserPermission(resource, resourceId, item.userId, EMPTY_PERMISSION);
    } else if (item.teamId) {
      promise = setTeamPermission(resource, resourceId, item.teamId, EMPTY_PERMISSION);
    } else if (item.builtInRole) {
      promise = setBuiltInRolePermission(resource, resourceId, item.builtInRole, EMPTY_PERMISSION);
    }

    if (promise !== null) {
      promise.then(fetchItems);
    }
  };

  const onChange = (item: ResourcePermission, permission: string) => {
    if (item.permission === permission) {
      return;
    }
    if (item.userId) {
      onAdd({ permission, userId: item.userId, target: PermissionTarget.User });
    } else if (item.teamId) {
      onAdd({ permission, teamId: item.teamId, target: PermissionTarget.Team });
    } else if (item.builtInRole) {
      onAdd({ permission, builtInRole: item.builtInRole, target: PermissionTarget.BuiltInRole });
    }
  };

  const teams = useMemo(
    () =>
      sortBy(
        items.filter((i) => i.teamId),
        ['team', 'isManaged']
      ),
    [items]
  );
  const users = useMemo(
    () =>
      sortBy(
        items.filter((i) => i.userId),
        ['userLogin', 'isManaged']
      ),
    [items]
  );
  const builtInRoles = useMemo(
    () =>
      sortBy(
        items.filter((i) => i.builtInRole),
        ['builtInRole', 'isManaged']
      ),
    [items]
  );

  return (
    <div>
      <div className="page-action-bar">
        <h3 className="page-sub-heading">{title}</h3>
        <div className="page-action-bar__spacer" />
        {canSetPermissions && (
          <Button variant={'primary'} key="add-permission" onClick={() => setIsAdding(true)}>
            {buttonLabel}
          </Button>
        )}
      </div>

      <div>
        <SlideDown in={isAdding}>
          <AddPermission
            title={addPermissionTitle}
            onAdd={onAdd}
            permissions={desc.permissions}
            assignments={desc.assignments}
            onCancel={() => setIsAdding(false)}
          />
        </SlideDown>
        <PermissionList
          title="Role"
          items={builtInRoles}
          compareKey={'builtInRole'}
          permissionLevels={desc.permissions}
          onChange={onChange}
          onRemove={onRemove}
          canSet={canSetPermissions}
        />
        <PermissionList
          title="User"
          items={users}
          compareKey={'userLogin'}
          permissionLevels={desc.permissions}
          onChange={onChange}
          onRemove={onRemove}
          canSet={canSetPermissions}
        />
        <PermissionList
          title="Team"
          items={teams}
          compareKey={'team'}
          permissionLevels={desc.permissions}
          onChange={onChange}
          onRemove={onRemove}
          canSet={canSetPermissions}
        />
      </div>
    </div>
  );
};

const getDescription = async (resource: string): Promise<Description> => {
  try {
    return await getBackendSrv().get(`/api/access-control/${resource}/description`);
  } catch (e) {
    console.error('failed to load resource description: ', e);
    return INITIAL_DESCRIPTION;
  }
};

const getPermissions = (resource: string, resourceId: ResourceId): Promise<ResourcePermission[]> =>
  getBackendSrv().get(`/api/access-control/${resource}/${resourceId}`);

const setUserPermission = (resource: string, resourceId: ResourceId, userId: number, permission: string) =>
  setPermission(resource, resourceId, 'users', userId, permission);

const setTeamPermission = (resource: string, resourceId: ResourceId, teamId: number, permission: string) =>
  setPermission(resource, resourceId, 'teams', teamId, permission);

const setBuiltInRolePermission = (resource: string, resourceId: ResourceId, builtInRole: string, permission: string) =>
  setPermission(resource, resourceId, 'builtInRoles', builtInRole, permission);

const setPermission = (
  resource: string,
  resourceId: ResourceId,
  type: Type,
  typeId: number | string,
  permission: string
): Promise<void> =>
  getBackendSrv().post(`/api/access-control/${resource}/${resourceId}/${type}/${typeId}`, { permission });
