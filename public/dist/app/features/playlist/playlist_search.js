import coreModule from '../../core/core_module';
var PlaylistSearchCtrl = /** @class */ (function () {
    /** @ngInject */
    function PlaylistSearchCtrl($timeout, backendSrv) {
        var _this = this;
        this.backendSrv = backendSrv;
        this.query = { query: '', tag: [], starred: false, limit: 20 };
        $timeout(function () {
            _this.query.query = '';
            _this.query.type = 'dash-db';
            _this.searchDashboards();
        }, 100);
    }
    PlaylistSearchCtrl.prototype.searchDashboards = function () {
        this.tagsMode = false;
        var prom = {};
        prom.promise = this.backendSrv.search(this.query).then(function (result) {
            return {
                dashboardResult: result,
                tagResult: [],
            };
        });
        this.searchStarted(prom);
    };
    PlaylistSearchCtrl.prototype.showStarred = function () {
        this.query.starred = !this.query.starred;
        this.searchDashboards();
    };
    PlaylistSearchCtrl.prototype.queryHasNoFilters = function () {
        return this.query.query === '' && this.query.starred === false && this.query.tag.length === 0;
    };
    PlaylistSearchCtrl.prototype.filterByTag = function (tag, evt) {
        this.query.tag.push(tag);
        this.searchDashboards();
        if (evt) {
            evt.stopPropagation();
            evt.preventDefault();
        }
    };
    PlaylistSearchCtrl.prototype.getTags = function () {
        var prom = {};
        prom.promise = this.backendSrv.get('/api/dashboards/tags').then(function (result) {
            return {
                dashboardResult: [],
                tagResult: result,
            };
        });
        this.searchStarted(prom);
    };
    return PlaylistSearchCtrl;
}());
export { PlaylistSearchCtrl };
export function playlistSearchDirective() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/playlist/partials/playlist_search.html',
        controller: PlaylistSearchCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            searchStarted: '&',
        },
    };
}
coreModule.directive('playlistSearch', playlistSearchDirective);
//# sourceMappingURL=playlist_search.js.map