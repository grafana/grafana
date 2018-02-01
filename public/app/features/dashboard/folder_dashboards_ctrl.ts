import { FolderPageLoader } from './folder_page_loader';

export class FolderDashboardsCtrl {
  navModel: any;
  folderId: number;
  folderSlug: string;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private $routeParams) {
    if (this.$routeParams.folderId && this.$routeParams.slug) {
      this.folderId = $routeParams.folderId;

      const loader = new FolderPageLoader(this.backendSrv, this.$routeParams);

      loader.load(this, this.folderId, 'manage-folder-dashboards').then(result => {
        this.folderSlug = result.meta.slug;
      });
    }
  }
}
