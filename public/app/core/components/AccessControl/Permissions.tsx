import { css } from '@emotion/css';
import { sortBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Space } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { t, Trans } from 'app/core/internationalization';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DescendantCount } from 'app/features/browse-dashboards/components/BrowseActions/DescendantCount';

import { ActionGridModal, ActionGridModalState, actionGridModalStateInit, ActionGridModalResult } from './ActionGrid';
import { AddPermission } from './AddPermission';
import { PermissionList } from './PermissionList';
import { emptyDescription, ResourceDescriptionCtx } from './ResourceDescription';
import { CUSTOM_RESOURCE_PERMISSION } from './ResourcePermissions';
import { Description, PermissionTarget, ResourcePermission, SetPermission } from './types';

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
};

export const Permissions = ({
  title = t('access-control.permissions.title', 'Permissions'),
  buttonLabel = t('access-control.permissions.add-label', 'Add a permission'),
  emptyLabel = t('access-control.permissions.no-permissions', 'There are no permissions'),
  resource,
  resourceId,
  canSetPermissions,
  addPermissionTitle,
}: Props) => {
  const styles = useStyles2(getStyles);
  const [isAdding, setIsAdding] = useState(false);
  const [items, setItems] = useState<ResourcePermission[]>([]);
  const [desc, setDesc] = useState(emptyDescription);
  const [actionGridModal, setActionGridModal] = useState<ActionGridModalState>(actionGridModalStateInit());

  const fetchItems = useCallback(() => {
    return getPermissions(resource, resourceId).then((r) => setItems(r));
  }, [resource, resourceId]);

  useEffect(() => {
    getDescription(resource).then((r) => {
      setDesc(r);
      return fetchItems();
    });
  }, [resource, resourceId, fetchItems]);

  function promptForActions(item: ResourcePermission, callback: (res: ActionGridModalResult) => void) {
    setActionGridModal({
      show: true,
      item,
      onClose: (res: ActionGridModalResult) => {
        setActionGridModal(actionGridModalStateInit());
        callback(res);
      },
    });
  }

  const onAdd = (state: SetPermission) => {
    let promise: Promise<void> | null = null;
    if (state.target === PermissionTarget.User) {
      promise = setUserPermission(resource, resourceId, state.userId!, state.permission, state.actions);
    } else if (state.target === PermissionTarget.ServiceAccount) {
      promise = setUserPermission(resource, resourceId, state.userId!, state.permission, state.actions);
    } else if (state.target === PermissionTarget.Team) {
      promise = setTeamPermission(resource, resourceId, state.teamId!, state.permission, state.actions);
    } else if (state.target === PermissionTarget.BuiltInRole) {
      promise = setBuiltInRolePermission(resource, resourceId, state.builtInRole!, state.permission, state.actions);
    }

    if (promise !== null) {
      promise.then(fetchItems);
    }
  };

  const onRemove = (item: ResourcePermission) => {
    let promise: Promise<void> | null = null;
    if (item.userId) {
      promise = setUserPermission(resource, resourceId, item.userId, '');
    } else if (item.teamId) {
      promise = setTeamPermission(resource, resourceId, item.teamId, '');
    } else if (item.isServiceAccount && item.userId) {
      promise = setUserPermission(resource, resourceId, item.userId, '');
    } else if (item.builtInRole) {
      promise = setBuiltInRolePermission(resource, resourceId, item.builtInRole, '');
    }

    if (promise !== null) {
      promise.then(fetchItems);
    }
  };

  const onChange = (item: ResourcePermission, selectedPermission: string) => {
    if (item.permission === selectedPermission) {
      return;
    }

    function selectChangeByTarget(permission: string, actions?: string[]) {
      if (item.userId) {
        onAdd({ permission, userId: item.userId, target: PermissionTarget.User, actions });
      } else if (item.isServiceAccount) {
        onAdd({ permission, userId: item.userId, target: PermissionTarget.User, actions });
      } else if (item.teamId) {
        onAdd({ permission, teamId: item.teamId, target: PermissionTarget.Team, actions });
      } else if (item.builtInRole) {
        onAdd({ permission, builtInRole: item.builtInRole, target: PermissionTarget.BuiltInRole, actions });
      }
    }

    if (selectedPermission === CUSTOM_RESOURCE_PERMISSION) {
      promptForActions(item, (res) => {
        if (res.selection === 'cancel') {
          return;
        }
        selectChangeByTarget(selectedPermission, res.actions);
      });
    } else {
      selectChangeByTarget(selectedPermission);
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
    <ResourceDescriptionCtx.Provider value={desc}>
      <ActionGridModal resource={desc.resource} {...actionGridModal} />
      <div>
        {canSetPermissions && (
          <>
            {resource === 'folders' && (
              <>
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
                <Space v={2} />
              </>
            )}
            <Button
              className={styles.addPermissionButton}
              variant={'primary'}
              key="add-permission"
              onClick={() => setIsAdding(true)}
            >
              {buttonLabel}
            </Button>
            <SlideDown in={isAdding}>
              <AddPermission title={addPermissionTitle} onAdd={onAdd} onCancel={() => setIsAdding(false)} />
            </SlideDown>
          </>
        )}
        {items.length === 0 && (
          <table className="filter-table gf-form-group">
            <tbody>
              <tr>
                <th>{emptyLabel}</th>
              </tr>
            </tbody>
          </table>
        )}
        <PermissionList
          title={titleRole}
          items={builtInRoles}
          compareKey={'builtInRole'}
          onChange={onChange}
          onRemove={onRemove}
          canSet={canSetPermissions}
        />
        <PermissionList
          title={titleUser}
          items={users}
          compareKey={'userLogin'}
          onChange={onChange}
          onRemove={onRemove}
          canSet={canSetPermissions}
        />
        <PermissionList
          title={titleServiceAccount}
          items={serviceAccounts}
          compareKey={'userLogin'}
          onChange={onChange}
          onRemove={onRemove}
          canSet={canSetPermissions}
        />

        <PermissionList
          title={titleTeam}
          items={teams}
          compareKey={'team'}
          onChange={onChange}
          onRemove={onRemove}
          canSet={canSetPermissions}
        />
      </div>
    </ResourceDescriptionCtx.Provider>
  );
};

const getDescription = async (resource: string): Promise<Description> => {
  try {
    const desc = await getBackendSrv().get(`/api/access-control/${resource}/description`);
    return {
      resource,
      ...desc,
    };
  } catch (e) {
    console.error('failed to load resource description: ', e);
    return emptyDescription;
  }
};

const getPermissions = (resource: string, resourceId: ResourceId): Promise<ResourcePermission[]> => {
  if (config.featureToggles.customResourcePermissionActions) {
    return getBackendSrv().get(`/api/access-control/${resource}/${resourceId}?require_permission=false`);
  }
  return getBackendSrv().get(`/api/access-control/${resource}/${resourceId}`);
};

const setUserPermission = (
  resource: string,
  resourceId: ResourceId,
  userId: number,
  permission: string,
  actions?: string[]
) => setPermission(resource, resourceId, 'users', userId, permission, actions);

const setTeamPermission = (
  resource: string,
  resourceId: ResourceId,
  teamId: number,
  permission: string,
  actions?: string[]
) => setPermission(resource, resourceId, 'teams', teamId, permission, actions);

const setBuiltInRolePermission = (
  resource: string,
  resourceId: ResourceId,
  builtInRole: string,
  permission: string,
  actions?: string[]
) => setPermission(resource, resourceId, 'builtInRoles', builtInRole, permission, actions);

const setPermission = (
  resource: string,
  resourceId: ResourceId,
  type: Type,
  typeId: number | string,
  permission: string,
  actions?: string[]
): Promise<void> => {
  const data: Record<string, string | number | string[]> = {};
  if (permission === CUSTOM_RESOURCE_PERMISSION && Array.isArray(actions)) {
    data.actions = actions;
  } else {
    data.permission = permission;
  }
  return getBackendSrv().post(`/api/access-control/${resource}/${resourceId}/${type}/${typeId}`, data);
};

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
