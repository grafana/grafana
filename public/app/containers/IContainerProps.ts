import { SearchStore } from './../stores/SearchStore/SearchStore';
import { ServerStatsStore } from './../stores/ServerStatsStore/ServerStatsStore';
import { NavStore } from './../stores/NavStore/NavStore';
import { PermissionsStore } from './../stores/PermissionsStore/PermissionsStore';
import { AlertListStore } from './../stores/AlertListStore/AlertListStore';
import { ViewStore } from './../stores/ViewStore/ViewStore';
import { FolderStore } from './../stores/FolderStore/FolderStore';

interface IContainerProps {
  search: typeof SearchStore.Type;
  serverStats: typeof ServerStatsStore.Type;
  nav: typeof NavStore.Type;
  alertList: typeof AlertListStore.Type;
  permissions: typeof PermissionsStore.Type;
  view: typeof ViewStore.Type;
  folder: typeof FolderStore.Type;
  backendSrv: any;
}

export default IContainerProps;
