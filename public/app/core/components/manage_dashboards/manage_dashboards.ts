import _ from 'lodash';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { SearchSrv } from 'app/core/services/search_srv';

class Query {
  query: string;
  mode: string;
  tag: any[];
  starred: boolean;
  skipRecent: boolean;
  skipStarred: boolean;
  folderIds: number[];
}

export class ManageDashboardsCtrl {
  sections: any[];

  query: Query;
  navModel: any;

  selectAllChecked = false;

  // enable/disable actions depending on the folders or dashboards selected
  canDelete = false;
  canMove = false;

  // filter variables
  hasFilters = false;
  tagFilterOptions: any[];
  selectedTagFilter: any;
  starredFilterOptions = [{ text: 'Filter by Starred', disabled: true }, { text: 'Yes' }, { text: 'No' }];
  selectedStarredFilter: any;

  // used when managing dashboards for a specific folder
  folderId?: number;
  folderUid?: string;

  // if user can add new folders and/or add new dashboards
  canSave = false;

  // if user has editor role or higher
  isEditor: boolean;

  hasEditPermissionInFolders: boolean;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private searchSrv: SearchSrv, private contextSrv) {
    this.isEditor = this.contextSrv.isEditor;
    this.hasEditPermissionInFolders = this.contextSrv.hasEditPermissionInFolders;

    this.query = {
      query: '',
      mode: 'tree',
      tag: [],
      starred: false,
      skipRecent: true,
      skipStarred: true,
      folderIds: [],
    };

    if (this.folderId) {
      this.query.folderIds = [this.folderId];
    }

    this.selectedStarredFilter = this.starredFilterOptions[0];

    this.refreshList().then(() => {
      this.initTagFilter();
    });
  }

  refreshList() {
    return this.searchSrv
      .search(this.query)
      .then(result => {
        return this.initDashboardList(result);
      })
      .then(() => {
        if (!this.folderUid) {
          return;
        }

        return this.backendSrv.getFolderByUid(this.folderUid).then(folder => {
          this.canSave = folder.canSave;
          if (!this.canSave) {
            this.hasEditPermissionInFolders = false;
          }
        });
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

    for (const section of this.sections) {
      section.checked = false;

      for (const dashboard of section.items) {
        dashboard.checked = false;
      }
    }

    if (this.folderId && this.sections.length > 0) {
      this.sections[0].hideHeader = true;
    }
  }

  selectionChanged() {
    let selectedDashboards = 0;

    for (const section of this.sections) {
      selectedDashboards += _.filter(section.items, { checked: true }).length;
    }

    const selectedFolders = _.filter(this.sections, { checked: true }).length;
    this.canMove = selectedDashboards > 0;
    this.canDelete = selectedDashboards > 0 || selectedFolders > 0;
  }

  getFoldersAndDashboardsToDelete() {
    const selectedDashboards = {
      folders: [],
      dashboards: [],
    };

    for (const section of this.sections) {
      if (section.checked && section.id !== 0) {
        selectedDashboards.folders.push(section.uid);
      } else {
        const selected = _.filter(section.items, { checked: true });
        selectedDashboards.dashboards.push(..._.map(selected, 'uid'));
      }
    }

    return selectedDashboards;
  }

  getFolderIds(sections) {
    const ids = [];
    for (const s of sections) {
      if (s.checked) {
        ids.push(s.id);
      }
    }
    return ids;
  }

  delete() {
    const data = this.getFoldersAndDashboardsToDelete();
    const folderCount = data.folders.length;
    const dashCount = data.dashboards.length;
    let text = 'Do you want to delete the ';
    let text2;

    if (folderCount > 0 && dashCount > 0) {
      text += `selected folder${folderCount === 1 ? '' : 's'} and dashboard${dashCount === 1 ? '' : 's'}?`;
      text2 = `All dashboards of the selected folder${folderCount === 1 ? '' : 's'} will also be deleted`;
    } else if (folderCount > 0) {
      text += `selected folder${folderCount === 1 ? '' : 's'} and all its dashboards?`;
    } else {
      text += `selected dashboard${dashCount === 1 ? '' : 's'}?`;
    }

    appEvents.emit('confirm-modal', {
      title: 'Delete',
      text: text,
      text2: text2,
      icon: 'fa-trash',
      yesText: 'Delete',
      onConfirm: () => {
        this.deleteFoldersAndDashboards(data.folders, data.dashboards);
      },
    });
  }

  private deleteFoldersAndDashboards(folderUids, dashboardUids) {
    this.backendSrv.deleteFoldersAndDashboards(folderUids, dashboardUids).then(() => {
      this.refreshList();
    });
  }

  getDashboardsToMove() {
    const selectedDashboards = [];

    for (const section of this.sections) {
      const selected = _.filter(section.items, { checked: true });
      selectedDashboards.push(..._.map(selected, 'uid'));
    }

    return selectedDashboards;
  }

  moveTo() {
    const selectedDashboards = this.getDashboardsToMove();

    const template =
      '<move-to-folder-modal dismiss="dismiss()" ' +
      'dashboards="model.dashboards" after-save="model.afterSave()">' +
      '</move-to-folder-modal>';
    appEvents.emit('show-modal', {
      templateHtml: template,
      modalClass: 'modal--narrow',
      model: {
        dashboards: selectedDashboards,
        afterSave: this.refreshList.bind(this),
      },
    });
  }

  initTagFilter() {
    return this.searchSrv.getDashboardTags().then(results => {
      this.tagFilterOptions = [{ term: 'Filter By Tag', disabled: true }].concat(results);
      this.selectedTagFilter = this.tagFilterOptions[0];
    });
  }

  filterByTag(tag) {
    if (_.indexOf(this.query.tag, tag) === -1) {
      this.query.tag.push(tag);
    }

    return this.refreshList();
  }

  onQueryChange() {
    return this.refreshList();
  }

  onTagFilterChange() {
    const res = this.filterByTag(this.selectedTagFilter.term);
    this.selectedTagFilter = this.tagFilterOptions[0];
    return res;
  }

  removeTag(tag, evt) {
    this.query.tag = _.without(this.query.tag, tag);
    this.refreshList();
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }
  }

  removeStarred() {
    this.query.starred = false;
    return this.refreshList();
  }

  onStarredFilterChange() {
    this.query.starred = this.selectedStarredFilter.text === 'Yes';
    this.selectedStarredFilter = this.starredFilterOptions[0];
    return this.refreshList();
  }

  onSelectAllChanged() {
    for (const section of this.sections) {
      if (!section.hideHeader) {
        section.checked = this.selectAllChecked;
      }

      section.items = _.map(section.items, item => {
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
    this.refreshList();
  }

  createDashboardUrl() {
    let url = 'dashboard/new';

    if (this.folderId) {
      url += `?folderId=${this.folderId}`;
    }

    return url;
  }

  importDashboardUrl() {
    let url = 'dashboard/import';

    if (this.folderId) {
      url += `?folderId=${this.folderId}`;
    }

    return url;
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
      folderId: '=',
      folderUid: '=',
    },
  };
}

coreModule.directive('manageDashboards', manageDashboardsDirective);
