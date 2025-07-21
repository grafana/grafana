import { css } from '@emotion/css';
import { sortBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Text, Box, Button, useStyles2 } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DescendantCount } from 'app/features/browse-dashboards/components/BrowseActions/DescendantCount';

import { AddPermission } from './AddPermission';
import { PermissionList } from './PermissionList';
import { PermissionTarget, ResourcePermission, SetPermission, Description } from './types';

const EMPTY_PERMISSION = '';

const INITIAL_DESCRIPTION: Description = {
  permissions: [],
  assignments: {
    teams: false,
    users: false,
    serviceAccounts: false,
    builtInRoles: false,
  },
};

type ResourceId = string | number;
type Type = 'users' | 'teams' | 'serviceAccounts' | 'builtInRoles';

export type Props = {
  title?: string;
  buttonLabel?: string;
  emptyLabel?: string;
  addPermissionTitle?: string;
  resource: string;
  resourceId: ResourceId;
  canSetPermissions: boolean;
  getWarnings?: (items: ResourcePermission[]) => ResourcePermission[];
  epilogue?: (items: ResourcePermission[]) => React.ReactNode;
};

export const Permissions = ({
  title = t('access-control.permissions.title', 'Permissions'),
  buttonLabel = t('access-control.permissions.add-label', 'Add a permission'),
  emptyLabel = t('access-control.permissions.no-permissions', 'There are no permissions'),
  resource,
  resourceId,
  canSetPermissions,
  addPermissionTitle,
  getWarnings,
  epilogue,
}: Props) => {
  const styles = useStyles2(getStyles);
  const [isAdding, setIsAdding] = useState(false);
  const [items, setItems] = useState<ResourcePermission[]>([]);
  const [desc, setDesc] = useState(INITIAL_DESCRIPTION);

  const fetchItems = useCallback(async () => {
    let items = await getPermissions(resource, resourceId);
    if (getWarnings) {
      items = getWarnings(items);
    }
    setItems(items);
  }, [resource, resourceId, getWarnings]);

  useEffect(() => {
    getDescription(resource).then((r) => {
      setDesc(r);
      return fetchItems();
    });
  }, [resource, resourceId, fetchItems]);

  const onAdd = (state: SetPermission) => {
    let promise: Promise<void> | null = null;
    if (state.target === PermissionTarget.User || state.target === PermissionTarget.ServiceAccount) {
      promise = setUserPermission(resource, resourceId, state.userUid!, state.permission);
    } else if (state.target === PermissionTarget.Team) {
      promise = setTeamPermission(resource, resourceId, state.teamUid!, state.permission);
    } else if (state.target === PermissionTarget.BuiltInRole) {
      promise = setBuiltInRolePermission(resource, resourceId, state.builtInRole!, state.permission);
    }

    if (promise !== null) {
      promise.then(fetchItems);
    }
  };

  const onRemove = (item: ResourcePermission) => {
    let promise: Promise<void> | null = null;
    if (item.userUid) {
      promise = setUserPermission(resource, resourceId, item.userUid, EMPTY_PERMISSION);
    } else if (item.teamUid) {
      promise = setTeamPermission(resource, resourceId, item.teamUid, EMPTY_PERMISSION);
    } else if (item.builtInRole) {
      promise = setBuiltInRolePermission(resource, resourceId, item.builtInRole, EMPTY_PERMISSION);
    }

    if (promise !== null) {
      promise.then(fetchItems);
    }
  };

  const onChange = (item: ResourcePermission, permission: string) => {
    console.log('onChange', item, permission);
    if (item.permission === permission) {
      return;
    }
    if (item.userUid || item.isServiceAccount) {
      onAdd({ permission, userUid: item.userUid, target: PermissionTarget.User });
    } else if (item.teamUid) {
      onAdd({ permission, teamUid: item.teamUid, target: PermissionTarget.Team });
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
        items.filter((i) => i.userId && !i.isServiceAccount),
        ['userLogin', 'isManaged']
      ),
    [items]
  );
  const serviceAccounts = useMemo(
    () =>
      sortBy(
        items.filter((i) => i.userId && i.isServiceAccount),
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

  const titleRole = t('access-control.permissions.role', 'Role');
  const titleUser = t('access-control.permissions.user', 'User');
  const titleServiceAccount = t('access-control.permissions.serviceaccount', 'Service Account');
  const titleTeam = t('access-control.permissions.team', 'Team');

  return (
    <>
      <div>
        {canSetPermissions && resource === 'folders' && (
          <Box paddingBottom={2}>
            <Trans i18nKey="access-control.permissions.permissions-change-warning">
              This will change permissions for this folder and all its descendants. In total, this will affect:
            </Trans>
            <DescendantCount
              selectedItems={{
                folder: { [resourceId]: true },
                dashboard: {},
                panel: {},
                $all: false,
              }}
            />
          </Box>
        )}
        {items.length === 0 && (
          <Box>
            <Text>{emptyLabel}</Text>
          </Box>
        )}
        <PermissionList
          title={titleRole}
          items={builtInRoles}
          compareKey={'builtInRole'}
          permissionLevels={desc.permissions}
          onChange={onChange}
          onRemove={onRemove}
          canSet={canSetPermissions}
        />
        <PermissionList
          title={titleUser}
          items={users}
          compareKey={'userLogin'}
          permissionLevels={desc.permissions}
          onChange={onChange}
          onRemove={onRemove}
          canSet={canSetPermissions}
        />
        <PermissionList
          title={titleServiceAccount}
          items={serviceAccounts}
          compareKey={'userLogin'}
          permissionLevels={desc.permissions}
          onChange={onChange}
          onRemove={onRemove}
          canSet={canSetPermissions}
        />
        <PermissionList
          title={titleTeam}
          items={teams}
          compareKey={'team'}
          permissionLevels={desc.permissions}
          onChange={onChange}
          onRemove={onRemove}
          canSet={canSetPermissions}
        />
        {canSetPermissions && (
          <>
            <Button
              className={styles.addPermissionButton}
              variant={'primary'}
              key="add-permission"
              onClick={() => setIsAdding(true)}
              icon="plus"
            >
              {buttonLabel}
            </Button>
            <SlideDown in={isAdding}>
              <AddPermission
                title={addPermissionTitle}
                onAdd={onAdd}
                permissions={desc.permissions}
                assignments={desc.assignments}
                onCancel={() => setIsAdding(false)}
              />
            </SlideDown>
          </>
        )}
      </div>
      {epilogue && epilogue(items)}
    </>
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

const setUserPermission = (resource: string, resourceId: ResourceId, userUid: string, permission: string) =>
  setPermission(resource, resourceId, 'users', userUid, permission);

const setTeamPermission = (resource: string, resourceId: ResourceId, teamUid: string, permission: string) =>
  setPermission(resource, resourceId, 'teams', teamUid, permission);

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

const getStyles = (theme: GrafanaTheme2) => ({
  breakdown: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(2),
  }),
  addPermissionButton: css({
    marginBottom: theme.spacing(2),
  }),
});
