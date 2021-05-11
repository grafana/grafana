export interface User {
  id: number;
  isGrafanaAdmin: any;
  isSignedIn: any;
  orgRole: any;
  orgId: number;
  orgName: string;
  login: string;
  orgCount: number;
  timezone: string;
  helpFlags1: number;
  lightTheme: boolean;
  hasEditPermissionInFolders: boolean;
  email?: string;
}

export interface ContextSrv {
    pinned: any;
    version: any;
    user: User;
    isSignedIn: any;
    isGrafanaAdmin: any;
    isEditor: any;
    hasEditPermissionInFolders: boolean;
    minRefreshInterval: string;
    setLoggedOut: () => void;
    hasRole: (role: string) => boolean;
    isGrafanaVisible: () => boolean;
    isAllowedInterval: (interval: string) => boolean;
    getValidInterval: (interval: string) => string;
    hasAccessToExplore: () => boolean;
}

let singletonInstance: ContextSrv;

/**
 * Used during startup by Grafana to set the ContextSrv so it is available
 * via the {@link getContextSrv} to the rest of the application.
 *
 * @internal
 */
export const setContextSrv = (instance: ContextSrv) => {
  singletonInstance = instance;
};

/**
 * Used to retrieve the {@link ContextSrv} that can be used to get user information
 *
 * @public
 */
export const getContextSrv = (): ContextSrv => singletonInstance;
