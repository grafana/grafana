import {
  userHasPermission,
  userHasPermissionInMetadata,
  userHasAllPermissions,
  userHasAnyPermission,
} from '@grafana/data';

import { getCurrentUser } from '../services/user';

export const hasPermission = (action: string) => userHasPermission(action, getCurrentUser());

export const hasPermissionInMetadata = (
  action: string,
  object: {
    accessControl?: Record<string, boolean>;
  }
) => userHasPermissionInMetadata(action, object);

export const hasAllPermissions = (actions: string[]) => userHasAllPermissions(actions, getCurrentUser());

export const hasAnyPermission = (actions: string[]) => userHasAnyPermission(actions, getCurrentUser());
