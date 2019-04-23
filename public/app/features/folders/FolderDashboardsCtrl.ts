import { FolderPageLoader } from './services/FolderPageLoader';
import locationUtil from 'app/core/utils/location_util';

export default class FolderDashboardsCtrl {
  navModel: any;
  folderId: number;
  uid: string;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private $routeParams, $location) {
    if (this.$routeParams.uid) {
      this.uid = $routeParams.uid;

      const loader = new FolderPageLoader(this.backendSrv);

      loader.load(this, this.uid, 'manage-folder-dashboards').then(folder => {
        const url = locationUtil.stripBaseFromUrl(folder.url);

        if (url !== $location.path()) {
          $location.path(url).replace();
        }
      });
    }
  }
}
