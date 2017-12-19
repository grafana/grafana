import { FolderPageLoader } from './folder_page_loader';

export class FolderPermissionsCtrl {
  navModel: any;
  folderId: number;
  dashboard: any;
  meta: any;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private $routeParams) {
    if (this.$routeParams.folderId && this.$routeParams.slug) {
      this.folderId = $routeParams.folderId;

      new FolderPageLoader(this.backendSrv, this.$routeParams)
        .load(this, this.folderId, "manage-folder-permissions")
        .then(result => {
          this.dashboard = result.dashboard;
          this.meta = result.meta;
        });
    }
  }
}
