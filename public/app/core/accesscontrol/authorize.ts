import { getBackendSrv } from '@grafana/runtime';
import { UserPermission } from 'app/types';

export interface Authorizer {
  getSignedInUserPermissions(reload: boolean): Promise<UserPermission>;
  hasPermission(principal: AuthorizationPrincipal, action: string): boolean;
  hasAnyPermission(principal: AuthorizationPrincipal, actions: string[]): boolean;
  hasAllPermissions(principal: AuthorizationPrincipal, actions: string[]): boolean;
}

interface AuthorizationPrincipal {
  permissions?: UserPermission;
}

function hasPermission(principal: AuthorizationPrincipal, action: string): boolean {
  return !!principal.permissions?.[action];
}

export class DefaultAuthorizer {
  async getSignedInUserPermissions(reload: boolean): Promise<UserPermission> {
    return await getBackendSrv().get('/api/access-control/user/actions', {
      reloadcache: reload,
    });
  }

  hasPermission(principal: AuthorizationPrincipal, action: string): boolean {
    return hasPermission(principal, action);
  }

  hasAnyPermission(principal: AuthorizationPrincipal, actions: string[]): boolean {
    return actions.some((action) => this.hasPermission(principal, action));
  }

  hasAllPermissions(principal: AuthorizationPrincipal, actions: string[]): boolean {
    return actions.every((action) => this.hasPermission(principal, action));
  }
}
