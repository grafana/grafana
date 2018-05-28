import _ from 'lodash';
import coreModule from '../../core_module';
import { SearchSrv } from 'app/core/services/search_srv';
import { contextSrv } from 'app/core/services/context_srv';
import appEvents from 'app/core/app_events';

export class SearchCtrl {
  isOpen: boolean;
  query: any;
  giveSearchFocus: number;
  selectedIndex: number;
  results: any;
  currentSearchId: number;
  showImport: boolean;
  dismiss: any;
  ignoreClose: any;
  isLoading: boolean;
  initialFolderFilterTitle: string;
  isEditor: string;
  hasEditPermissionInFolders: boolean;

  /** @ngInject */
  constructor($scope, private $location, private $timeout, private searchSrv: SearchSrv) {
    appEvents.on('show-dash-search', this.openSearch.bind(this), $scope);
    appEvents.on('hide-dash-search', this.closeSearch.bind(this), $scope);

    this.initialFolderFilterTitle = 'All';
    this.getTags = this.getTags.bind(this);
    this.onTagSelect = this.onTagSelect.bind(this);
    this.isEditor = contextSrv.isEditor;
    this.hasEditPermissionInFolders = contextSrv.hasEditPermissionInFolders;
  }

  closeSearch() {
    this.isOpen = this.ignoreClose;
  }

  openSearch(evt, payload) {
    if (this.isOpen) {
      this.closeSearch();
      return;
    }

    this.isOpen = true;
    this.giveSearchFocus = 0;
    this.selectedIndex = -1;
    this.results = [];
    this.query = { query: '', tag: [], starred: false };
    this.currentSearchId = 0;
    this.ignoreClose = true;
    this.isLoading = true;

    if (payload && payload.starred) {
      this.query.starred = true;
    }

    this.$timeout(() => {
      this.ignoreClose = false;
      this.giveSearchFocus = this.giveSearchFocus + 1;
      this.search();
    }, 100);
  }

  keyDown(evt) {
    if (evt.keyCode === 27) {
      this.closeSearch();
    }
    if (evt.keyCode === 40) {
      this.moveSelection(1);
    }
    if (evt.keyCode === 38) {
      this.moveSelection(-1);
    }
    if (evt.keyCode === 13) {
      const flattenedResult = this.getFlattenedResultForNavigation();
      const currentItem = flattenedResult[this.selectedIndex];

      if (currentItem) {
        if (currentItem.dashboardIndex !== undefined) {
          const selectedDash = this.results[currentItem.folderIndex].items[currentItem.dashboardIndex];

          if (selectedDash) {
            this.$location.search({});
            this.$location.path(selectedDash.url);
            this.closeSearch();
          }
        } else {
          const selectedFolder = this.results[currentItem.folderIndex];

          if (selectedFolder) {
            selectedFolder.toggle(selectedFolder);
          }
        }
      }
    }
  }

  onFilterboxClick() {
    this.giveSearchFocus = 0;
    this.preventClose();
  }

  preventClose() {
    this.ignoreClose = true;

    this.$timeout(() => {
      this.ignoreClose = false;
    }, 100);
  }

  moveSelection(direction) {
    if (this.results.length === 0) {
      return;
    }

    const flattenedResult = this.getFlattenedResultForNavigation();
    const currentItem = flattenedResult[this.selectedIndex];

    if (currentItem) {
      if (currentItem.dashboardIndex !== undefined) {
        this.results[currentItem.folderIndex].items[currentItem.dashboardIndex].selected = false;
      } else {
        this.results[currentItem.folderIndex].selected = false;
      }
    }

    if (direction === 0) {
      this.selectedIndex = -1;
      return;
    }

    const max = flattenedResult.length;
    let newIndex = this.selectedIndex + direction;
    this.selectedIndex = (newIndex %= max) < 0 ? newIndex + max : newIndex;
    const selectedItem = flattenedResult[this.selectedIndex];

    if (selectedItem.dashboardIndex === undefined && this.results[selectedItem.folderIndex].id === 0) {
      this.moveSelection(direction);
      return;
    }

    if (selectedItem.dashboardIndex !== undefined) {
      if (!this.results[selectedItem.folderIndex].expanded) {
        this.moveSelection(direction);
        return;
      }

      this.results[selectedItem.folderIndex].items[selectedItem.dashboardIndex].selected = true;
      return;
    }

    if (this.results[selectedItem.folderIndex].hideHeader) {
      this.moveSelection(direction);
      return;
    }

    this.results[selectedItem.folderIndex].selected = true;
  }

  searchDashboards() {
    this.currentSearchId = this.currentSearchId + 1;
    var localSearchId = this.currentSearchId;

    return this.searchSrv.search(this.query).then(results => {
      if (localSearchId < this.currentSearchId) {
        return;
      }
      this.results = results || [];
      this.isLoading = false;
      this.moveSelection(1);
    });
  }

  queryHasNoFilters() {
    var query = this.query;
    return query.query === '' && query.starred === false && query.tag.length === 0;
  }

  filterByTag(tag) {
    if (_.indexOf(this.query.tag, tag) === -1) {
      this.query.tag.push(tag);
      this.search();
    }
  }

  removeTag(tag, evt) {
    this.query.tag = _.without(this.query.tag, tag);
    this.search();
    this.giveSearchFocus = this.giveSearchFocus + 1;
    evt.stopPropagation();
    evt.preventDefault();
  }

  getTags() {
    return this.searchSrv.getDashboardTags();
  }

  onTagSelect(newTags) {
    this.query.tag = _.map(newTags, tag => tag.value);
    this.search();
  }

  clearSearchFilter() {
    this.query.tag = [];
    this.search();
  }

  showStarred() {
    this.query.starred = !this.query.starred;
    this.giveSearchFocus = this.giveSearchFocus + 1;
    this.search();
  }

  search() {
    this.showImport = false;
    this.selectedIndex = -1;
    this.searchDashboards();
  }

  folderExpanding() {
    this.moveSelection(0);
  }

  private getFlattenedResultForNavigation() {
    let folderIndex = 0;

    return _.flatMap(this.results, s => {
      let result = [];

      result.push({
        folderIndex: folderIndex,
      });

      let dashboardIndex = 0;

      result = result.concat(
        _.map(s.items || [], i => {
          return {
            folderIndex: folderIndex,
            dashboardIndex: dashboardIndex++,
          };
        })
      );

      folderIndex++;
      return result;
    });
  }
}

export function searchDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/core/components/search/search.html',
    controller: SearchCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {},
  };
}

coreModule.directive('dashboardSearch', searchDirective);
