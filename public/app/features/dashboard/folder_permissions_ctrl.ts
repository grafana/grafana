import { FolderPageLoader } from './folder_page_loader';

export class FolderPermissionsCtrl {
  navModel: any;
  folderId: number;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private $routeParams) {
    if (this.$routeParams.folderId && this.$routeParams.slug) {
      this.folderId = $routeParams.folderId;

      new FolderPageLoader(this.backendSrv, this.$routeParams).load(
        this,
        this.folderId,
        'manage-folder-permissions'
      );
    }
  }
}
