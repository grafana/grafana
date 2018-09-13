import { FolderState } from 'app/types';
import { DashboardAcl, DashboardAclDTO } from 'app/types/acl';
import { Action, ActionTypes } from './actions';

export const inititalState: FolderState = {
  id: 0,
  uid: 'loading',
  title: 'loading',
  url: '',
  canSave: false,
  hasChanged: false,
  version: 1,
  permissions: [],
};

export const folderReducer = (state = inititalState, action: Action): FolderState => {
  switch (action.type) {
    case ActionTypes.LoadFolder:
      return {
        ...state,
        ...action.payload,
        hasChanged: false,
      };
    case ActionTypes.SetFolderTitle:
      return {
        ...state,
        title: action.payload,
        hasChanged: action.payload.trim().length > 0,
      };
    case ActionTypes.LoadFolderPermissions:
      return {
        ...state,
        permissions: processAclItems(action.payload),
      };
  }
  return state;
};

function processAclItems(items: DashboardAclDTO[]): DashboardAcl[] {
  return items.map(processAclItem).sort((a, b) => b.sortRank - a.sortRank || a.name.localeCompare(b.name));
}

function processAclItem(dto: DashboardAclDTO): DashboardAcl {
  const item = dto as DashboardAcl;

  item.sortRank = 0;
  if (item.userId > 0) {
    item.name = item.userLogin;
    item.sortRank = 10;
  } else if (item.teamId > 0) {
    item.name = item.team;
    item.sortRank = 20;
  } else if (item.role) {
    item.icon = 'fa fa-fw fa-street-view';
    item.name = item.role;
    item.sortRank = 30;
    if (item.role === 'Editor') {
      item.sortRank += 1;
    }
  }

  if (item.inherited) {
    item.sortRank += 100;
  }

  return item;
}

export default {
  folder: folderReducer,
};
