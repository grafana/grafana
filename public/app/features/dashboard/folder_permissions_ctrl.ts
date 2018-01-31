import { FolderPageLoader } from './folder_page_loader';

export class FolderPermissionsCtrl {
  navModel: any;
  folderId: number;
  uid: string;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private $routeParams) {
    if (this.$routeParams.uid) {
      this.uid = $routeParams.uid;

      new FolderPageLoader(this.backendSrv).load(this, this.uid, 'manage-folder-permissions');
    }
  }
}
