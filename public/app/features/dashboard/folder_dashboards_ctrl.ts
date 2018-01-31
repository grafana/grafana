import { FolderPageLoader } from './folder_page_loader';

export class FolderDashboardsCtrl {
  navModel: any;
  folderId: number;
  uid: string;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private $routeParams, $location) {
    if (this.$routeParams.uid) {
      this.uid = $routeParams.uid;

      const loader = new FolderPageLoader(this.backendSrv);

      loader.load(this, this.uid, 'manage-folder-dashboards').then(folder => {
        if ($location.path() !== folder.meta.url) {
          $location.path(folder.meta.url).replace();
        }
      });
    }
  }
}
