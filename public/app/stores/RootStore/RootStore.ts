import { types } from 'mobx-state-tree';
import { NavStore } from './../NavStore/NavStore';
import { ViewStore } from './../ViewStore/ViewStore';
import { FolderStore } from './../FolderStore/FolderStore';
import { PermissionsStore } from './../PermissionsStore/PermissionsStore';

export const RootStore = types.model({
  nav: types.optional(NavStore, {}),
  permissions: types.optional(PermissionsStore, {
    fetching: false,
    items: [],
  }),
  view: types.optional(ViewStore, {
    path: '',
    query: {},
    routeParams: {},
  }),
  folder: types.optional(FolderStore, {}),
});

type RootStoreType = typeof RootStore.Type;
export interface RootStoreInterface extends RootStoreType {}
