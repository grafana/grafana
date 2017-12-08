import {FolderPageLoader} from './folder_page_loader';

export class FolderPermissionsCtrl {
  navModel: any;
  folderId: number;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private $routeParams) {
    if (this.$routeParams.folderId && this.$routeParams.type && this.$routeParams.slug) {
      this.folderId = $routeParams.folderId;
      this.navModel = navModelSrv.getNav('manage-folder', 'manage-folder-permissions', 0);

      new FolderPageLoader(this.backendSrv, this.$routeParams).load(this.navModel, this.folderId);
    }
  }
}
