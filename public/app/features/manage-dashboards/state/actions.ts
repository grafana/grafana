import { getBackendSrv } from 'app/core/services/backend_srv';
import { StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';
import { FolderDTO, NavModelItem } from 'app/types';
import { updateNavIndex, UpdateNavIndexAction } from 'app/core/actions';

export enum ActionTypes {
  LoadFolder = 'LOAD_FOLDER',
}

export interface LoadFolderAction {
  type: ActionTypes.LoadFolder;
  payload: FolderDTO;
}

export const loadFolder = (folder: FolderDTO): LoadFolderAction => ({
  type: ActionTypes.LoadFolder,
  payload: folder,
});

export type Action = LoadFolderAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action | UpdateNavIndexAction>;

function buildNavModel(folder: FolderDTO): NavModelItem {
  return {
    icon: 'fa fa-folder-open',
    id: 'manage-folder',
    subTitle: 'Manage folder dashboards & permissions',
    url: '',
    text: folder.title,
    breadcrumbs: [{ title: 'Dashboards', url: 'dashboards' }],
    children: [
      {
        active: false,
        icon: 'fa fa-fw fa-th-large',
        id: `folder-dashboards-${folder.uid}`,
        text: 'Dashboards',
        url: folder.url,
      },
      {
        active: false,
        icon: 'fa fa-fw fa-lock',
        id: `folder-permissions-${folder.uid}`,
        text: 'Permissions',
        url: `${folder.url}/permissions`,
      },
      {
        active: false,
        icon: 'fa fa-fw fa-cog',
        id: `folder-settings-${folder.uid}`,
        text: 'Settings',
        url: `${folder.url}/settings`,
      },
    ],
  };
}
export function getFolderByUid(uid: string): ThunkResult<void> {
  return async dispatch => {
    const folder = await getBackendSrv().getFolderByUid(uid);
    dispatch(loadFolder(folder));
    dispatch(updateNavIndex(buildNavModel(folder)));
  };
}
