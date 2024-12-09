import { WithAccessControlMetadata } from '../types/accesscontrol';
import { CurrentUserDTO } from '../types/config';

export interface CurrentUser extends Omit<CurrentUserDTO, 'lightTheme'> {}

export function userHasPermission(action: string, user: CurrentUser): boolean {
  return !!user.permissions?.[action];
}

export function userHasPermissionInMetadata(action: string, object: WithAccessControlMetadata): boolean {
  return !!object.accessControl?.[action];
}

export function userHasAllPermissions(actions: string[], user: CurrentUser) {
  return actions.every((action) => userHasPermission(action, user));
}

export function userHasAnyPermission(actions: string[], user: CurrentUser) {
  return actions.some((action) => userHasPermission(action, user));
}
