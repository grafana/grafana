import { NavStore } from './../stores/NavStore/NavStore';
import { PermissionsStore } from './../stores/PermissionsStore/PermissionsStore';
import { ViewStore } from './../stores/ViewStore/ViewStore';

interface ContainerProps {
  nav: typeof NavStore.Type;
  permissions: typeof PermissionsStore.Type;
  view: typeof ViewStore.Type;
  backendSrv: any;
}

export default ContainerProps;
