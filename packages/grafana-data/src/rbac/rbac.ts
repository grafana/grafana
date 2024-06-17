import { CurrentUserDTO } from '../types';

export interface CurrentUser extends Omit<CurrentUserDTO, 'lightTheme'> {}

export function userHasPermission(action: string, user: CurrentUser): boolean {
  return !!user.permissions?.[action];
}

export function userHasPermissionInMetadata(
  action: string,
  object: WithAccessControlMetadata,
): boolean {
  return !!object.accessControl?.[action];
}

export function userHasAllPermissions(actions: string[], user: CurrentUser) {
  if (actions.every((action) => userHasPermission(action, user))) {
    return [];
  }
  return ['Reject'];
}

export function userHasAnyPermission(actions: string[], user: CurrentUser) {
  if (actions.some((action) => userHasPermission(action, user))) {
    return [];
  }
  return ['Reject'];
}
