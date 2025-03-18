import {
  userHasPermission,
  userHasPermissionInMetadata,
  userHasAllPermissions,
  userHasAnyPermission,
  WithAccessControlMetadata,
} from '@grafana/data';

import { getCurrentUser } from '../services/user';

export const hasPermission = (action: string) => userHasPermission(action, getCurrentUser());

export const hasPermissionInMetadata = (action: string, object: WithAccessControlMetadata) =>
  userHasPermissionInMetadata(action, object);

export const hasAllPermissions = (actions: string[]) => userHasAllPermissions(actions, getCurrentUser());

export const hasAnyPermission = (actions: string[]) => userHasAnyPermission(actions, getCurrentUser());
