import _, { debounce } from 'lodash';
import coreModule from '../../core_module';
import { SearchSrv } from 'app/core/services/search_srv';
import { contextSrv } from 'app/core/services/context_srv';

import appEvents from 'app/core/app_events';
import { parse, SearchParserOptions, SearchParserResult } from 'search-query-parser';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { CoreEvents } from 'app/types';

export interface SearchQuery {
  query: string;
  parsedQuery: SearchParserResult;
  tags: string[];
  starred: boolean;
}

class SearchQueryParser {
  config: SearchParserOptions;
  constructor(config: SearchParserOptions) {
    this.config = config;
  }

  parse(query: string) {
    const parsedQuery = parse(query, this.config);

    if (typeof parsedQuery === 'string') {
      return {
        text: parsedQuery,
      } as SearchParserResult;
    }

    return parsedQuery;
  }
}

interface SelectedIndicies {
  dashboardIndex?: number;
  folderIndex?: number;
}

interface OpenSearchParams {
  query?: string;
}

export class SearchCtrl {
  isOpen: boolean;
  query: SearchQuery;
  giveSearchFocus: boolean;
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
  queryParser: SearchQueryParser;

  /** @ngInject */
  constructor(private $scope: any, private $location: any, private $timeout: any, private searchSrv: SearchSrv) {
    appEvents.on(CoreEvents.showDashSearch, this.openSearch.bind(this), $scope);
    appEvents.on(CoreEvents.hideDashSearch, this.closeSearch.bind(this), $scope);
    appEvents.on(CoreEvents.searchQuery, debounce(this.search.bind(this), 500), $scope);

    this.initialFolderFilterTitle = 'All';
    this.isEditor = contextSrv.isEditor;
    this.hasEditPermissionInFolders = contextSrv.hasEditPermissionInFolders;
    this.onQueryChange = this.onQueryChange.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.query = {
      query: '',
      parsedQuery: { text: '' },
      tags: [],
      starred: false,
    };

    this.queryParser = new SearchQueryParser({
      keywords: ['folder'],
    });
  }

  closeSearch() {
    this.isOpen = this.ignoreClose;
  }

  onQueryChange(query: SearchQuery | string) {
    if (typeof query === 'string') {
      this.query = {
        ...this.query,
        parsedQuery: this.queryParser.parse(query),
        query: query,
      };
    } else {
      this.query = query;
    }
    appEvents.emit(CoreEvents.searchQuery);
  }

  openSearch(payload: OpenSearchParams = {}) {
    if (this.isOpen) {
      this.closeSearch();
      return;
    }

    this.isOpen = true;
    this.giveSearchFocus = true;
    this.selectedIndex = -1;
    this.results = [];
    this.query = {
      query: payload.query ? `${payload.query} ` : '',
      parsedQuery: this.queryParser.parse(payload.query),
      tags: [],
      starred: false,
    };

    this.currentSearchId = 0;
    this.ignoreClose = true;
    this.isLoading = true;

    this.$timeout(() => {
      this.ignoreClose = false;
      this.giveSearchFocus = true;
      this.search();
    }, 100);
  }

  onKeyDown(evt: KeyboardEvent) {
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
    this.giveSearchFocus = false;
    this.preventClose();
  }

  preventClose() {
    this.ignoreClose = true;

    this.$timeout(() => {
      this.ignoreClose = false;
    }, 100);
  }

  moveSelection(direction: number) {
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
    const newIndex = (this.selectedIndex + direction) % max;
    this.selectedIndex = newIndex < 0 ? newIndex + max : newIndex;
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

  searchDashboards(folderContext?: string) {
    this.currentSearchId = this.currentSearchId + 1;
    const localSearchId = this.currentSearchId;
    const folderIds = [];

    const { parsedQuery } = this.query;

    if (folderContext === 'current') {
      folderIds.push(getDashboardSrv().getCurrent().meta.folderId);
    }

    const query = {
      ...this.query,
      query: parsedQuery.text,
      tag: this.query.tags,
      folderIds,
    };

    return this.searchSrv
      .search({
        ...query,
      })
      .then(results => {
        if (localSearchId < this.currentSearchId) {
          return;
        }
        this.results = results || [];
        this.isLoading = false;
        this.moveSelection(1);
        this.$scope.$digest();
      });
  }

  queryHasNoFilters() {
    const query = this.query;
    return query.query === '' && query.starred === false && query.tags.length === 0;
  }

  filterByTag = (tag: string) => {
    if (tag) {
      if (_.indexOf(this.query.tags, tag) === -1) {
        this.query.tags.push(tag);
        this.search();
      }
    }
  };

  removeTag(tag: string, evt: any) {
    this.query.tags = _.without(this.query.tags, tag);
    this.search();
    this.giveSearchFocus = true;
    evt.stopPropagation();
    evt.preventDefault();
  }

  getTags = () => {
    return this.searchSrv.getDashboardTags();
  };

  onTagFiltersChanged = (tags: string[]) => {
    this.query.tags = tags;
    this.search();
  };

  clearSearchFilter() {
    this.query.query = '';
    this.query.tags = [];
    this.search();
  }

  showStarred() {
    this.query.starred = !this.query.starred;
    this.giveSearchFocus = true;
    this.search();
  }

  selectionChanged = () => {
    // TODO remove after React-side state management is implemented
    // This method is only used as a callback after toggling section, to trigger results rerender
  };

  search() {
    this.showImport = false;
    this.selectedIndex = -1;
    this.searchDashboards(this.query.parsedQuery['folder']);
  }

  folderExpanding = () => {
    this.moveSelection(0);
  };

  private getFlattenedResultForNavigation(): SelectedIndicies[] {
    let folderIndex = 0;

    return _.flatMap(this.results, (s: any) => {
      let result: SelectedIndicies[] = [];

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
