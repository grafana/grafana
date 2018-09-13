import { DashboardAcl } from '../../types';

export enum ActionTypes {
  LoadFolderPermissions = 'LoadFolderPermissions',
}

export interface LoadFolderPermissionsAction {
  type: ActionTypes.LoadFolderPermissions;
  payload: DashboardAcl[];
}

export type Action = LoadFolderPermissions;

export const loadFolderPermissions = (items: DashboardAcl[]): LoadFolderPermissionsAction => ({
  type: ActionTypes.LoadFolderPermissions,
  payload: items,
});

export function getFolderPermissions(uid: string): ThunkResult<void> {
  return async dispatch => {
    const permissions = await backendSrv.get(`/api/folders/${uid}/permissions`);
    dispatch(loadFolderPermissions(permissions));
  };
}
