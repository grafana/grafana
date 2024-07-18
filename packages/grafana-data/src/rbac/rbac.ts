import { getBackendSrv } from '../../../grafana-runtime/src/services/backendSrv'; // can't be used here, userHasPermission would need to move
import { WithAccessControlMetadata } from '../types/accesscontrol';
import { CurrentUserDTO } from '../types/config';


export interface CurrentUser extends Omit<CurrentUserDTO, 'lightTheme'> { }

export function userHasPermission(action: string, user: CurrentUser): boolean {
  let permissions: Record<string, boolean> | undefined;
  if (window?.grafanaBootData?.settings?.featureToggles?.noFrontendPermissionCache) {
    try {
      // replace with check endpoint in the future
      getBackendSrv().get('/api/access-control/user/actions', {
        reloadcache: false,
      }).then((res: Record<string, boolean>) => { permissions = res; });
    } catch (e) {
      console.error(e);
      permissions = user.permissions;
    }
  } else {
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
