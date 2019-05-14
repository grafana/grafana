import _ from 'lodash';
import coreModule from '../../core_module';
import appEvents from 'app/core/app_events';
var SearchResultsCtrl = /** @class */ (function () {
    /** @ngInject */
    function SearchResultsCtrl($location) {
        this.$location = $location;
    }
    SearchResultsCtrl.prototype.toggleFolderExpand = function (section) {
        var _this = this;
        if (section.toggle) {
            if (!section.expanded && this.onFolderExpanding) {
                this.onFolderExpanding();
            }
            section.toggle(section).then(function (f) {
                if (_this.editable && f.expanded) {
                    if (f.items) {
                        _.each(f.items, function (i) {
                            i.checked = f.checked;
                        });
                        if (_this.onSelectionChanged) {
                            _this.onSelectionChanged();
                        }
                    }
                }
            });
        }
    };
    SearchResultsCtrl.prototype.navigateToFolder = function (section, evt) {
        this.$location.path(section.url);
        if (evt) {
            evt.stopPropagation();
            evt.preventDefault();
        }
    };
    SearchResultsCtrl.prototype.toggleSelection = function (item, evt) {
        item.checked = !item.checked;
        if (item.items) {
            _.each(item.items, function (i) {
                i.checked = item.checked;
            });
        }
        if (this.onSelectionChanged) {
            this.onSelectionChanged();
        }
        if (evt) {
            evt.stopPropagation();
            evt.preventDefault();
        }
    };
    SearchResultsCtrl.prototype.onItemClick = function (item) {
        //Check if one string can be found in the other
        if (this.$location.path().indexOf(item.url) > -1 || item.url.indexOf(this.$location.path()) > -1) {
            appEvents.emit('hide-dash-search');
        }
    };
    SearchResultsCtrl.prototype.selectTag = function (tag, evt) {
        if (this.onTagSelected) {
            this.onTagSelected({ $tag: tag });
        }
        if (evt) {
            evt.stopPropagation();
            evt.preventDefault();
        }
    };
    return SearchResultsCtrl;
}());
export { SearchResultsCtrl };
export function searchResultsDirective() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/core/components/search/search_results.html',
        controller: SearchResultsCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            editable: '@',
            results: '=',
            onSelectionChanged: '&',
            onTagSelected: '&',
            onFolderExpanding: '&',
        },
    };
}
coreModule.directive('dashboardSearchResults', searchResultsDirective);
//# sourceMappingURL=search_results.js.map