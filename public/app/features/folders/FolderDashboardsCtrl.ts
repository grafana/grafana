import { FolderPageLoader } from './services/FolderPageLoader';
import locationUtil from 'app/core/utils/location_util';
import { NavModelSrv } from 'app/core/core';
import { ILocationService } from 'angular';

export default class FolderDashboardsCtrl {
  navModel: any;
  folderId: number;
  uid: string;

  /** @ngInject */
  constructor(
    private backendSrv: any,
    navModelSrv: NavModelSrv,
    private $routeParams: any,
    $location: ILocationService
  ) {
    if (this.$routeParams.uid) {
      this.uid = $routeParams.uid;

      const loader = new FolderPageLoader(this.backendSrv);

      loader.load(this, this.uid, 'manage-folder-dashboards').then((folder: any) => {
        const url = locationUtil.stripBaseFromUrl(folder.url);

        if (url !== $location.path()) {
          $location.path(url).replace();
        }
      });
    }
  }
}
