import { FolderPageLoader } from './folder_page_loader';

export class FolderPermissionsCtrl {
  navModel: any;
  folderId: number;
  uid: string;
  dashboard: any;
  meta: any;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private $routeParams, $location) {
    if (this.$routeParams.uid) {
      this.uid = $routeParams.uid;

      new FolderPageLoader(this.backendSrv).load(this, this.uid, 'manage-folder-permissions').then(folder => {
        if ($location.path() !== folder.meta.url) {
          $location.path(`${folder.meta.url}/permissions`).replace();
        }

        this.dashboard = folder.dashboard;
        this.meta = folder.meta;
      });
    }
  }
}
