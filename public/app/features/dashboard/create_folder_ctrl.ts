import appEvents from 'app/core/app_events';

export class CreateFolderCtrl {
  title = '';
  navModel: any;
  nameExists = false;
  titleTouched = false;

  /** @ngInject **/
  constructor(private backendSrv, private $location, navModelSrv) {
    this.navModel = navModelSrv.getNav('dashboards', 'manage-dashboards', 0);
  }

  create() {
    if (!this.title || this.title.trim().length === 0) {
      return;
    }

    const title = this.title.trim();

    return this.backendSrv.createDashboardFolder(title).then(result => {
      appEvents.emit('alert-success', ['Folder Created', 'OK']);

      var folderUrl = `/dashboards/folder/${result.dashboard.id}/${result.meta.slug}`;
      this.$location.url(folderUrl);
    });
  }

  titleChanged() {
    this.titleTouched = true;

    this.backendSrv.search({query: this.title}).then(res => {
      this.nameExists = false;
      for (let hit of res) {
        if (this.title === hit.title) {
          this.nameExists = true;
          break;
        }
      }
    });
  }
}
