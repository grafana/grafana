import { NavStore } from './../stores/NavStore/NavStore';
import { PermissionsStore } from './../stores/PermissionsStore/PermissionsStore';
import { ViewStore } from './../stores/ViewStore/ViewStore';
import { FolderStore } from './../stores/FolderStore/FolderStore';

interface ContainerProps {
  nav: typeof NavStore.Type;
  permissions: typeof PermissionsStore.Type;
  view: typeof ViewStore.Type;
  folder: typeof FolderStore.Type;
  backendSrv: any;
}

export default ContainerProps;
