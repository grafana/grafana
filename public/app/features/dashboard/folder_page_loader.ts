import _ from "lodash";

export class FolderPageLoader {
  constructor(private backendSrv, private $routeParams) { }

  load(navModel, folderId) {
    this.backendSrv.getDashboard(this.$routeParams.type, this.$routeParams.slug).then(result => {
      const folderTitle = result.dashboard.title;
      navModel.main.text = '';
      navModel.main.breadcrumbs = [
        { title: 'Dashboards', uri: '/dashboards' },
        { title: folderTitle }
      ];
      const folderUrl = `/dashboards/folder/${folderId}/${result.meta.type}/${result.meta.slug}`;
      const dashTab = _.find(navModel.main.children, { id: 'manage-folder-dashboards' });
      dashTab.url = folderUrl;
      const permTab = _.find(navModel.main.children, { id: 'manage-folder-permissions' });
      permTab.url = folderUrl + '/permissions';
    });
  }
}
