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
  public sections: any[];

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

  /** @ngInject */
  constructor(private backendSrv, navModelSrv, private searchSrv: SearchSrv, private contextSrv) {
    this.isEditor = this.contextSrv.isEditor;

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

        return this.backendSrv.getDashboardByUid(this.folderUid).then(dash => {
          this.canSave = dash.meta.canSave;
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

    for (let section of this.sections) {
      section.checked = false;

      for (let dashboard of section.items) {
        dashboard.checked = false;
      }
    }

    if (this.folderId && this.sections.length > 0) {
      this.sections[0].hideHeader = true;
    }
  }

  selectionChanged() {
    let selectedDashboards = 0;

    for (let section of this.sections) {
      selectedDashboards += _.filter(section.items, { checked: true }).length;
    }

    const selectedFolders = _.filter(this.sections, { checked: true }).length;
    this.canMove = selectedDashboards > 0;
    this.canDelete = selectedDashboards > 0 || selectedFolders > 0;
  }

  getFoldersAndDashboardsToDelete() {
    let selectedDashboards = {
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
    for (let s of sections) {
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
        const foldersAndDashboards = data.folders.concat(data.dashboards);
        this.deleteFoldersAndDashboards(foldersAndDashboards);
      },
    });
  }

  private deleteFoldersAndDashboards(uids) {
    this.backendSrv.deleteDashboards(uids).then(result => {
      const folders = _.filter(result, dash => dash.meta.isFolder);
      const folderCount = folders.length;
      const dashboards = _.filter(result, dash => !dash.meta.isFolder);
      const dashCount = dashboards.length;

      if (result.length > 0) {
        let header;
        let msg;

        if (folderCount > 0 && dashCount > 0) {
          header = `Folder${folderCount === 1 ? '' : 's'} And Dashboard${dashCount === 1 ? '' : 's'} Deleted`;
          msg = `${folderCount} folder${folderCount === 1 ? '' : 's'} `;
          msg += `and ${dashCount} dashboard${dashCount === 1 ? '' : 's'} has been deleted`;
        } else if (folderCount > 0) {
          header = `Folder${folderCount === 1 ? '' : 's'} Deleted`;

          if (folderCount === 1) {
            msg = `${folders[0].dashboard.title} has been deleted`;
          } else {
            msg = `${folderCount} folder${folderCount === 1 ? '' : 's'} has been deleted`;
          }
        } else if (dashCount > 0) {
          header = `Dashboard${dashCount === 1 ? '' : 's'} Deleted`;

          if (dashCount === 1) {
            msg = `${dashboards[0].dashboard.title} has been deleted`;
          } else {
            msg = `${dashCount} dashboard${dashCount === 1 ? '' : 's'} has been deleted`;
          }
        }

        appEvents.emit('alert-success', [header, msg]);
      }

      this.refreshList();
    });
  }

  getDashboardsToMove() {
    let selectedDashboards = [];

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
      '</move-to-folder-modal>`';
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
    var res = this.filterByTag(this.selectedTagFilter.term);
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
    for (let section of this.sections) {
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
