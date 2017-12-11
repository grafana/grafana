import _ from 'lodash';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { SearchSrv } from 'app/core/services/search_srv';

export class ManageDashboardsCtrl {
  public sections: any[];
  tagFilterOptions: any[];
  selectedTagFilter: any;
  query: any;
  navModel: any;
  canDelete = false;
  canMove = false;
  hasFilters = false;
  selectAllChecked = false;
  starredFilterOptions = [{ text: 'Filter by Starred', disabled: true }, { text: 'Yes' }, { text: 'No' }];
  selectedStarredFilter: any;
  folderId?: number;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private $q, private searchSrv: SearchSrv) {
    this.query = { query: '', mode: 'tree', tag: [], starred: false, skipRecent: true, skipStarred: true };

    if (this.folderId) {
      this.query.folderIds = [this.folderId];
    }

    this.selectedStarredFilter = this.starredFilterOptions[0];

    this.getDashboards().then(() => {
      this.getTags();
    });
  }

  getDashboards() {
    return this.searchSrv.search(this.query).then((result) => {
      return this.initDashboardList(result);
    });
  }

  initDashboardList(result: any) {
    this.canMove = false;
    this.canDelete = false;
    this.selectAllChecked = false;
    this.hasFilters = this.query.query.length > 0 || this.query.tag.length > 0 || this.query.starred;

    if (!result) {
      this.sections = [];
      return;
    }

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
      selectedDashboards += _.filter(section.items, { checked: true }).length;
    }

    const selectedFolders = _.filter(this.sections, { checked: true }).length;
    this.canMove = selectedDashboards > 0 && selectedFolders === 0;
    this.canDelete = selectedDashboards > 0 || selectedFolders > 0;
  }

  getDashboardsToDelete() {
    let selectedDashboards = [];

    for (const section of this.sections) {
      if (section.checked) {
        selectedDashboards.push(section.uri);
      } else {
        const selected = _.filter(section.items, { checked: true });
        selectedDashboards.push(..._.map(selected, 'uri'));
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
    const selectedDashboards = this.getDashboardsToDelete();

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
      const selected = _.filter(section.items, { checked: true });
      selectedDashboards.push(..._.map(selected, 'uri'));
    }

    return selectedDashboards;
  }

  moveTo() {
    const selectedDashboards = this.getDashboardsToMove();

    const template = '<move-to-folder-modal dismiss="dismiss()" ' +
      'dashboards="model.dashboards" from-folder-id="model.fromFolderId" after-save="model.afterSave()">' +
      '</move-to-folder-modal>`';
    appEvents.emit('show-modal', {
      templateHtml: template,
      modalClass: 'modal--narrow',
      model: { dashboards: selectedDashboards, fromFolderId: this.folderId ? Number(this.folderId) : 0, afterSave: this.getDashboards.bind(this) }
    });
  }

  getTags() {
    return this.searchSrv.getDashboardTags().then((results) => {
      this.tagFilterOptions = [{ term: 'Filter By Tag', disabled: true }].concat(results);
      this.selectedTagFilter = this.tagFilterOptions[0];
    });
  }

  filterByTag(tag) {
    if (_.indexOf(this.query.tag, tag) === -1) {
      this.query.tag.push(tag);
    }

    return this.getDashboards();
  }

  onQueryChange() {
    return this.getDashboards();
  }

  onTagFilterChange() {
    var res = this.filterByTag(this.selectedTagFilter.term);
    this.selectedTagFilter = this.tagFilterOptions[0];
    return res;
  }

  removeTag(tag, evt) {
    this.query.tag = _.without(this.query.tag, tag);
    this.getDashboards();
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }
  }

  onStarredFilterChange() {
    this.query.starred = this.selectedStarredFilter.text === 'Yes';
    return this.getDashboards();
  }

  onSelectAllChanged() {
    for (let section of this.sections) {
      if (!section.hideHeader) {
        section.checked = this.selectAllChecked;
      }

      section.items = _.map(section.items, (item) => {
        item.checked = this.selectAllChecked;
        return item;
      });
    }

    this.selectionChanged();
  }

  clearFilters() {
    this.query.query = '';
    this.query.tag = [];
    this.query.starred = false;
    this.getDashboards();
  }
}

export function manageDashboardsDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/core/components/manage_dashboards/manage_dashboards.html',
    controller: ManageDashboardsCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      folderId: '='
    }
  };
}

coreModule.directive('manageDashboards', manageDashboardsDirective);
