import { ILocationService, IScope } from 'angular';

import { FolderPageLoader } from './services/FolderPageLoader';
import { NavModelSrv } from 'app/core/core';
import { promiseToDigest } from '../../core/utils/promiseToDigest';
import { locationUtil } from '@grafana/data';

export default class FolderDashboardsCtrl {
  navModel: any;
  folderId: number;
  uid: string;

  /** @ngInject */
  constructor(
    navModelSrv: NavModelSrv,
    private $routeParams: any,
    $location: ILocationService,
    private $scope: IScope
  ) {
    if (this.$routeParams.uid) {
      this.uid = $routeParams.uid;

      const loader = new FolderPageLoader();

      promiseToDigest(this.$scope)(
        loader.load(this, this.uid, 'manage-folder-dashboards').then((folder: any) => {
          const url = locationUtil.stripBaseFromUrl(folder.url);

          if (url !== $location.path()) {
            $location.path(url).replace();
          }
        })
      );
    }
  }
}
