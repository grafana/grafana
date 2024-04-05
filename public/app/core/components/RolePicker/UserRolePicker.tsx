import { isEqual } from 'lodash';
import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { contextSrv } from 'app/core/core';
import { Role, OrgRole, AccessControlAction } from 'app/types';

import { RolePicker, GenericRolePickerProps } from './RolePicker';
import { fetchUserRoles, updateUserRoles } from './api';

export interface UserRolePickerProps extends GenericRolePickerProps {
  // RolePicker overrides
  basicRole: OrgRole;
  onBasicRoleChange: (newRole: OrgRole) => void;
  // Local props
  userId: number;
  orgId?: number;
  // TODO: remove these two and implement the logic higher up
  apply?: boolean;
  onApplyRoles?: (newRoles: Role[], userId: number, orgId: number | undefined) => void;
  pendingRoles?: Role[];
}

export const UserRolePicker = ({
  // RolePicker props
  currentRoles,
  isLoading,
  apply = false,
  // Local props
  userId,
  orgId,
  // TODO: remove these two
  onApplyRoles,
  pendingRoles,
  ...rolePickerProps
}: UserRolePickerProps) => {
  const [userRolesState, getUserRoles] = useAsyncFn(async () => {
    try {
      if (isEqual(currentRoles, userRolesState.value)) {
        return currentRoles;
      }
      if (apply && Array.isArray(pendingRoles) && pendingRoles.length > 0) {
        return pendingRoles;
      }
      if (contextSrv.hasPermission(AccessControlAction.ActionUserRolesList) && userId > 0) {
        return await fetchUserRoles(userId, orgId);
      }
    } catch (e) {
      // TODO handle error
      console.error('Error loading options');
    }
    return [];
  }, [orgId, userId, pendingRoles, currentRoles]);

  useEffect(() => {
    if (orgId) {
      getUserRoles();
    }
  }, [getUserRoles, orgId]);

  // TODO: this will need to be changed after I remove the logic for apply
  const onRolesChange = async (roles: Role[]) => {
    if (!apply) {
      await updateUserRoles(roles, userId, orgId);
      await getUserRoles();
    } else if (onApplyRoles) {
      onApplyRoles(roles, userId, orgId);
    }
  };

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

  if (apply) {
    rolePickerProps.submitButtonText = 'Apply';
  }

  return (
    <RolePicker
      currentRoles={userRolesState.value || []}
      onRolesChange={onRolesChange}
      isLoading={userRolesState.loading || isLoading}
      showBasicRole
      canUpdateRoles={canUpdateRoles}
      {...rolePickerProps}
    />
  );
};
