import _ from 'lodash';
import appEvents from 'app/core/app_events';

export class DashboardListCtrl {
  public dashboards: any [];
  query: any;
  navModel: any;
  canDelete = false;
  canMove = false;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private $q) {
    this.navModel = navModelSrv.getNav('cfg', 'dashboards');
    this.query = {query: '', mode: 'tree', tag: []};
    this.getDashboards();
  }

  getDashboards() {
    return this.backendSrv.search(this.query).then((result) => {

      this.dashboards = this.groupDashboardsInFolders(result);

      for (let dash of this.dashboards) {
        dash.checked = false;
      }
    });
  }

  groupDashboardsInFolders(results) {
    let byId = _.groupBy(results, 'id');
    let byFolderId = _.groupBy(results, 'folderId');
    let finalList = [];

    // add missing parent folders
    _.each(results, (hit, index) => {
      if (hit.folderId && !byId[hit.folderId]) {
        const folder = {
          id: hit.folderId,
          uri: `db/${hit.folderSlug}`,
          title: hit.folderTitle,
          type: 'dash-folder'
        };
        byId[hit.folderId] = folder;
        results.splice(index, 0, folder);
      }
    });

    // group by folder
    for (let hit of results) {
      if (hit.folderId) {
        hit.type = "dash-child";
      } else {
        finalList.push(hit);
      }

      hit.url = 'dashboard/' + hit.uri;

      if (hit.type === 'dash-folder') {
        if (!byFolderId[hit.id]) {
          continue;
        }

        for (let child of byFolderId[hit.id]) {
          finalList.push(child);
        }
      }
    }

    return finalList;
  }

  selectionChanged() {
    const selected = _.filter(this.dashboards, {checked: true}).length;
    this.canDelete = selected > 0;

    const selectedDashboards = _.filter(this.dashboards, (o) => {
      return o.checked && (o.type === 'dash-db' || o.type === 'dash-child');
    }).length;

    const selectedFolders = _.filter(this.dashboards, {checked: true, type: 'dash-folder'}).length;
    this.canMove = selectedDashboards > 0 && selectedFolders === 0;
  }

  getDashboardsToDelete() {
    const selectedFolderIds = this.getFolderIds(this.dashboards);
    return _.filter(this.dashboards, o => {
      return o.checked && (
        o.type !== 'dash-child' ||
        (o.type === 'dash-child' && !_.includes(selectedFolderIds, o.folderId))
      );
    });
  }

  getFolderIds(dashboards) {
    const ids = [];
    for (let dash of dashboards) {
      if (dash.type === 'dash-folder') {
        ids.push(dash.id);
      }
    }
    return ids;
  }

  delete() {
    const selectedDashboards =  this.getDashboardsToDelete();

    appEvents.emit('confirm-modal', {
      title: 'Delete',
      text: `Do you want to delete the ${selectedDashboards.length} selected dashboards?`,
      icon: 'fa-trash',
      yesText: 'Delete',
      onConfirm: () => {
        const promises = [];
        for (let dash of selectedDashboards) {
          promises.push(this.backendSrv.delete(`/api/dashboards/${dash.uri}`));
        }

        this.$q.all(promises).then(() => {
          this.getDashboards();
        });
      }
    });
  }

  moveTo() {
    const selectedDashboards =  _.filter(this.dashboards, {checked: true});

    const template = '<move-to-folder-modal dismiss="dismiss()" ' +
      'dashboards="model.dashboards" after-save="model.afterSave()">' +
      '</move-to-folder-modal>`';
    appEvents.emit('show-modal', {
      templateHtml: template,
      modalClass: 'modal--narrow',
      model: {dashboards: selectedDashboards, afterSave: this.getDashboards.bind(this)}
    });
  }

  filterByTag(tag, evt) {
    this.query.tag.push(tag);
    this.getDashboards();
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }
  }

  removeTag(tag, evt) {
    this.query.tag = _.without(this.query.tag, tag);
    this.getDashboards();
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }
  }
}
