import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SlideDown } from 'app/core/components/Animations/SlideDown';

import { getBackendSrv } from 'app/core/services/backend_srv';
import { Button } from '@grafana/ui';
import { AclTarget, ResourcePermission, SetResourcePermission, SystemDescription } from './types';
import { AddResourcePermission } from './components/AddResourcePermission';
import { ResourcePermissionTable } from './components/ResourcePermissionsList';

const permissionNone = '';

const initialDescription: SystemDescription = {
  permissions: [],
  assignments: {
    teams: false,
    users: false,
    builtInRoles: false,
  },
};

export type Props = {
  resource: string;
  resourceId: number;

  canListUsers: boolean;
  canSetPermissions: boolean;
};

// TODO: error handling
export const ResourcePermissions = ({ resource, resourceId, canListUsers, canSetPermissions }: Props) => {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [items, setItems] = useState<ResourcePermission[]>([]);
  const [desc, setDesc] = useState<SystemDescription>(initialDescription);

  const fetchItems = useCallback(() => {
    return getPermissions(resource, resourceId).then((r) => setItems(r));
  }, [resource, resourceId]);

  useEffect(() => {
    getDescription(resource)
      .then((r) => {
        setDesc(r);
        return fetchItems();
      })
      .catch((e) => {});
  }, [resource, resourceId, fetchItems]);

  const onAdd = (state: SetResourcePermission) => {
    let promise: Promise<void> | null = null;
    if (state.target === AclTarget.User) {
      promise = setUserPermission(resource, resourceId, state.userId!, state.permission);
    } else if (state.target === AclTarget.Team) {
      promise = setTeamPermission(resource, resourceId, state.teamId!, state.permission);
    } else if (state.target === AclTarget.BuiltInRole) {
      promise = setBuiltInRolePermission(resource, resourceId, state.builtInRole!, state.permission);
    }

    if (promise !== null) {
      promise.then(() => fetchItems());
    }
  };

  const onRemove = (item: ResourcePermission) => {
    let promise: Promise<void> | null = null;
    if (item.userId) {
      promise = setUserPermission(resource, resourceId, item.userId, permissionNone);
    } else if (item.teamId) {
      promise = setTeamPermission(resource, resourceId, item.teamId, permissionNone);
    } else if (item.builtInRole) {
      promise = setBuiltInRolePermission(resource, resourceId, item.builtInRole, permissionNone);
    }

    if (promise !== null) {
      promise.then(() => fetchItems());
    }
  };

  const onChange = (p: ResourcePermission, permission: string) => {
    if (p.permission === permission) {
      return;
    }
    if (p.userId) {
      onAdd({ permission, userId: p.userId, target: AclTarget.User });
    } else if (p.teamId) {
      onAdd({ permission, teamId: p.teamId, target: AclTarget.Team });
    } else if (p.builtInRole) {
      onAdd({ permission, builtInRole: p.builtInRole, target: AclTarget.BuiltInRole });
    }
  };

  const teams = useMemo(() => items.filter((i) => i.teamId).sort(sortOn('team')), [items]);
  const users = useMemo(() => items.filter((i) => i.userId).sort(sortOn('userLogin')), [items]);
  const builtInRoles = useMemo(() => items.filter((i) => i.builtInRole).sort(sortOn('builtInRole')), [items]);

  return (
    <div>
      <div className="page-action-bar">
        <h3 className="page-sub-heading">Permissions</h3>
        <div className="page-action-bar__spacer" />
        {canSetPermissions && (
          <Button variant={'primary'} key="add-permission" onClick={() => setIsAdding(true)}>
            Add a permission
          </Button>
        )}
      </div>

      <div>
        <SlideDown in={isAdding}>
          <AddResourcePermission
            onAdd={onAdd}
            permissions={desc.permissions}
            assignments={desc.assignments}
            canListUsers={canListUsers}
            onCancel={() => setIsAdding(false)}
          />
        </SlideDown>
        <ResourcePermissionTable
          title="Roles"
          items={builtInRoles}
          permissions={desc.permissions}
          onChange={onChange}
          onRemove={onRemove}
          canRemove={canSetPermissions}
        />
        <ResourcePermissionTable
          title="Users"
          items={users}
          permissions={desc.permissions}
          onChange={onChange}
          onRemove={onRemove}
          canRemove={canSetPermissions}
        />
        <ResourcePermissionTable
          title="Teams"
          items={teams}
          permissions={desc.permissions}
          onChange={onChange}
          onRemove={onRemove}
          canRemove={canSetPermissions}
        />
      </div>
    </div>
  );
};

const getDescription = (resource: string): Promise<SystemDescription> => {
  return getBackendSrv().get<SystemDescription>(`/api/access-control/system/${resource}/description`);
};

const getPermissions = (resource: string, datasourceId: number): Promise<ResourcePermission[]> => {
  return getBackendSrv().get<ResourcePermission[]>(`/api/access-control/system/${resource}/${datasourceId}`);
};

const setUserPermission = (resource: string, resourceId: number, userId: number, permission: string) => {
  return getBackendSrv().post(`/api/access-control/system/${resource}/${resourceId}/users/${userId}`, { permission });
};

const setTeamPermission = (resource: string, resourceId: number, teamId: number, permission: string) => {
  return getBackendSrv().post(`/api/access-control/system/${resource}/${resourceId}/teams/${teamId}`, { permission });
};

const setBuiltInRolePermission = (resource: string, resourceId: number, builtInRole: string, permission: string) => {
  return getBackendSrv().post(`/api/access-control/system/${resource}/${resourceId}/builtInRoles/${builtInRole}`, {
    permission,
  });
};

const sortOn = (key: 'userLogin' | 'team' | 'builtInRole') => {
  return (a: ResourcePermission, b: ResourcePermission): number => {
    if (a[key]! > b[key]!) {
      return 1;
    }
    if (a[key]! < b[key]!) {
      return -1;
    }
    return 0;
  };
};
