import _ from 'lodash';
import appEvents from 'app/core/app_events';
import { SearchSrv } from 'app/core/services/search_srv';

export class DashboardListCtrl {
  public sections: any [];
  tags: any [];
  query: any;
  navModel: any;
  canDelete = false;
  canMove = false;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private $q, private searchSrv: SearchSrv) {
    this.navModel = navModelSrv.getNav('dashboards', 'dashboards');
    this.query = {query: '', mode: 'tree', tag: []};

    this.getDashboards();
    // this.getDashboards().then(() => {
    //   this.getTags();
    // });
  }

  getDashboards() {
    if (this.query.query.length === 0 && this.query.tag.length === 0) {
      return this.searchSrv.browse().then((result) => {
        return this.initDashboardList(result);
      });
    }

    return this.searchSrv.search(this.query).then((result) => {
      return this.initDashboardList(result);
    });
  }

  initDashboardList(result: any) {
    this.sections = result;

    for (let section of this.sections) {
      section.checked = false;

      for (let dashboard of section.items) {
        dashboard.checked = false;
      }
    }
  }

  selectionChanged() {

    let selectedDashboards = 0;

    for (let section of this.sections) {
      selectedDashboards += _.filter(section.items, {checked: true}).length;
    }

    const selectedFolders = _.filter(this.sections, {checked: true}).length;
    this.canMove = selectedDashboards > 0 && selectedFolders === 0;
    this.canDelete = selectedDashboards > 0 || selectedFolders > 0;
  }

  getDashboardsToDelete() {
    let selectedDashboards = [];

    for (const section of this.sections) {
      if (section.checked) {
        selectedDashboards.push(section.uri);
      } else {
        const selected = _.filter(section.items, {checked: true});
        selectedDashboards.push(... _.map(selected, 'uri'));
      }
    }

    return selectedDashboards;
  }

  getFolderIds(sections) {
    const ids = [];
    for (let s of sections) {
      if (s.checked) {
        ids.push(s.id);
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
          promises.push(this.backendSrv.delete(`/api/dashboards/${dash}`));
        }

        this.$q.all(promises).then(() => {
          this.getDashboards();
        });
      }
    });
  }

  getDashboardsToMove() {
    let selectedDashboards = [];

    for (const section of this.sections) {
      const selected = _.filter(section.items, {checked: true});
      selectedDashboards.push(... _.map(selected, 'uri'));
    }

    return selectedDashboards;
  }

  moveTo() {
    const selectedDashboards = this.getDashboardsToMove();

    const template = '<move-to-folder-modal dismiss="dismiss()" ' +
      'dashboards="model.dashboards" after-save="model.afterSave()">' +
      '</move-to-folder-modal>`';
    appEvents.emit('show-modal', {
      templateHtml: template,
      modalClass: 'modal--narrow',
      model: {dashboards: selectedDashboards, afterSave: this.getDashboards.bind(this)}
    });
  }

  // getTags() {
  //   return this.backendSrv.get('/api/dashboards/tags').then((results) => {
  //     this.tags = results;
  //   });
  // }

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
