import { getBackendSrv } from '../../../grafana-runtime/src/services/backendSrv'; // hacky import for specific ask. Clean if kept.
import { WithAccessControlMetadata } from '../types/accesscontrol';
import { CurrentUserDTO } from '../types/config';


export interface CurrentUser extends Omit<CurrentUserDTO, 'lightTheme'> { }

export function userHasPermission(action: string, user: CurrentUser): boolean {
  let permissions: Record<string, boolean> | undefined;
  try {
    getBackendSrv().get('/api/access-control/user/actions', {
      reloadcache: false,
    }).then((res: Record<string, boolean>) => { permissions = res; });
  } catch (e) {
    console.error(e);
    permissions = user.permissions;
  }
  return !!permissions?.[action];
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
