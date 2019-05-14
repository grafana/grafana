import * as tslib_1 from "tslib";
import _ from 'lodash';
import coreModule from '../../core_module';
import { contextSrv } from 'app/core/services/context_srv';
import appEvents from 'app/core/app_events';
var SearchCtrl = /** @class */ (function () {
    /** @ngInject */
    function SearchCtrl($scope, $location, $timeout, searchSrv) {
        var _this = this;
        this.$location = $location;
        this.$timeout = $timeout;
        this.searchSrv = searchSrv;
        this.getTags = function () {
            return _this.searchSrv.getDashboardTags();
        };
        this.onTagFiltersChanged = function (tags) {
            _this.query.tag = tags;
            _this.search();
        };
        appEvents.on('show-dash-search', this.openSearch.bind(this), $scope);
        appEvents.on('hide-dash-search', this.closeSearch.bind(this), $scope);
        this.initialFolderFilterTitle = 'All';
        this.isEditor = contextSrv.isEditor;
        this.hasEditPermissionInFolders = contextSrv.hasEditPermissionInFolders;
    }
    SearchCtrl.prototype.closeSearch = function () {
        this.isOpen = this.ignoreClose;
    };
    SearchCtrl.prototype.openSearch = function (evt, payload) {
        var _this = this;
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
        this.$timeout(function () {
            _this.ignoreClose = false;
            _this.giveSearchFocus = _this.giveSearchFocus + 1;
            _this.search();
        }, 100);
    };
    SearchCtrl.prototype.keyDown = function (evt) {
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
            var flattenedResult = this.getFlattenedResultForNavigation();
            var currentItem = flattenedResult[this.selectedIndex];
            if (currentItem) {
                if (currentItem.dashboardIndex !== undefined) {
                    var selectedDash = this.results[currentItem.folderIndex].items[currentItem.dashboardIndex];
                    if (selectedDash) {
                        this.$location.search({});
                        this.$location.path(selectedDash.url);
                        this.closeSearch();
                    }
                }
                else {
                    var selectedFolder = this.results[currentItem.folderIndex];
                    if (selectedFolder) {
                        selectedFolder.toggle(selectedFolder);
                    }
                }
            }
        }
    };
    SearchCtrl.prototype.onFilterboxClick = function () {
        this.giveSearchFocus = 0;
        this.preventClose();
    };
    SearchCtrl.prototype.preventClose = function () {
        var _this = this;
        this.ignoreClose = true;
        this.$timeout(function () {
            _this.ignoreClose = false;
        }, 100);
    };
    SearchCtrl.prototype.moveSelection = function (direction) {
        if (this.results.length === 0) {
            return;
        }
        var flattenedResult = this.getFlattenedResultForNavigation();
        var currentItem = flattenedResult[this.selectedIndex];
        if (currentItem) {
            if (currentItem.dashboardIndex !== undefined) {
                this.results[currentItem.folderIndex].items[currentItem.dashboardIndex].selected = false;
            }
            else {
                this.results[currentItem.folderIndex].selected = false;
            }
        }
        if (direction === 0) {
            this.selectedIndex = -1;
            return;
        }
        var max = flattenedResult.length;
        var newIndex = (this.selectedIndex + direction) % max;
        this.selectedIndex = newIndex < 0 ? newIndex + max : newIndex;
        var selectedItem = flattenedResult[this.selectedIndex];
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
    };
    SearchCtrl.prototype.searchDashboards = function () {
        var _this = this;
        this.currentSearchId = this.currentSearchId + 1;
        var localSearchId = this.currentSearchId;
        var query = tslib_1.__assign({}, this.query, { tag: this.query.tag });
        return this.searchSrv.search(query).then(function (results) {
            if (localSearchId < _this.currentSearchId) {
                return;
            }
            _this.results = results || [];
            _this.isLoading = false;
            _this.moveSelection(1);
        });
    };
    SearchCtrl.prototype.queryHasNoFilters = function () {
        var query = this.query;
        return query.query === '' && query.starred === false && query.tag.length === 0;
    };
    SearchCtrl.prototype.filterByTag = function (tag) {
        if (_.indexOf(this.query.tag, tag) === -1) {
            this.query.tag.push(tag);
            this.search();
        }
    };
    SearchCtrl.prototype.removeTag = function (tag, evt) {
        this.query.tag = _.without(this.query.tag, tag);
        this.search();
        this.giveSearchFocus = this.giveSearchFocus + 1;
        evt.stopPropagation();
        evt.preventDefault();
    };
    SearchCtrl.prototype.clearSearchFilter = function () {
        this.query.tag = [];
        this.search();
    };
    SearchCtrl.prototype.showStarred = function () {
        this.query.starred = !this.query.starred;
        this.giveSearchFocus = this.giveSearchFocus + 1;
        this.search();
    };
    SearchCtrl.prototype.search = function () {
        this.showImport = false;
        this.selectedIndex = -1;
        this.searchDashboards();
    };
    SearchCtrl.prototype.folderExpanding = function () {
        this.moveSelection(0);
    };
    SearchCtrl.prototype.getFlattenedResultForNavigation = function () {
        var folderIndex = 0;
        return _.flatMap(this.results, function (s) {
            var result = [];
            result.push({
                folderIndex: folderIndex,
            });
            var dashboardIndex = 0;
            result = result.concat(_.map(s.items || [], function (i) {
                return {
                    folderIndex: folderIndex,
                    dashboardIndex: dashboardIndex++,
                };
            }));
            folderIndex++;
            return result;
        });
    };
    return SearchCtrl;
}());
export { SearchCtrl };
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
//# sourceMappingURL=search.js.map