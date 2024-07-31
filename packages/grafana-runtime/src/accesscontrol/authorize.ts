import { locationService, type BackendSrv } from '../services';

type PermissionMap = Record<string, boolean>;

export interface Authorizer {
  getSignedInUserPermissions(reload: boolean): Promise<PermissionMap>;
  hasPermission(principal: AuthorizationPrincipal, action: string): boolean;
  hasAnyPermission(principal: AuthorizationPrincipal, actions: string[]): boolean;
  hasAllPermissions(principal: AuthorizationPrincipal, actions: string[]): boolean;
}

interface AuthorizationPrincipal {
  permissions?: PermissionMap;
}

function hasPermission(principal: AuthorizationPrincipal, action: string): boolean {
  return !!principal.permissions?.[action];
}

/**
 * DefaultAuthorizer is one that makes authorization decisions based on passed information.
 * It would be up to the user of DefaultAuthorizer to decide how to store and provide authorization
 * information to checks.
 */
export class DefaultAuthorizer implements Authorizer {
  private backend: () => BackendSrv;

  constructor(backend: () => BackendSrv) {
    this.backend = backend;
  }

  async getSignedInUserPermissions(reload: boolean): Promise<PermissionMap> {
    return await this.backend().get('/api/access-control/user/actions', {
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

/**
 * OptimisticAuthorizer is one that increases the rate at which permissions are refreshed for the user.
 * Permissions are refreshed through every page navigation and are more fresh than the
 * DefaultAuthorizer.
 */
export class OptimisticAuthorizer implements Authorizer {
  private backend: () => BackendSrv;
  private permissions?: PermissionMap;
  private singleflight: Promise<PermissionMap> | null;

  constructor(backend: () => BackendSrv, permissions?: PermissionMap) {
    this.backend = backend;
    this.permissions = permissions;
    this.singleflight = null;

    locationService.listen(() => {
      this.getSignedInUserPermissions(false);
    });
  }

  getSignedInUserPermissions(reload: boolean): Promise<PermissionMap> {
    if (this.singleflight !== null) {
      return this.singleflight;
    }

    const result = this.backend()
      .get('/api/access-control/user/actions', {
        reloadcache: reload,
      })
      .then((permissions) => {
        this.permissions = permissions;
        this.singleflight = null;
        return permissions;
      })
      .catch((_) => {
        this.singleflight = null;
      });

    this.singleflight = result;
    return result;
  }

  hasPermission(_: AuthorizationPrincipal, action: string): boolean {
    return hasPermission({ permissions: this.permissions }, action);
  }

  hasAnyPermission(_: AuthorizationPrincipal, actions: string[]): boolean {
    return actions.some((action) => this.hasPermission({ permissions: this.permissions }, action));
  }

  hasAllPermissions(_: AuthorizationPrincipal, actions: string[]): boolean {
    return actions.every((action) => this.hasPermission({ permissions: this.permissions }, action));
  }
}
