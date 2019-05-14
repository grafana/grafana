import * as tslib_1 from "tslib";
import _ from 'lodash';
import { PanelCtrl } from 'app/plugins/sdk';
import impressionSrv from 'app/core/services/impression_srv';
var DashListCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(DashListCtrl, _super);
    /** @ngInject */
    function DashListCtrl($scope, $injector, backendSrv, dashboardSrv) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.backendSrv = backendSrv;
        _this.dashboardSrv = dashboardSrv;
        _this.panelDefaults = {
            query: '',
            limit: 10,
            tags: [],
            recent: false,
            search: false,
            starred: true,
            headings: true,
            folderId: null,
        };
        _.defaults(_this.panel, _this.panelDefaults);
        if (_this.panel.tag) {
            _this.panel.tags = [_this.panel.tag];
            delete _this.panel.tag;
        }
        _this.events.on('refresh', _this.onRefresh.bind(_this));
        _this.events.on('init-edit-mode', _this.onInitEditMode.bind(_this));
        _this.groups = [
            { list: [], show: false, header: 'Starred dashboards' },
            { list: [], show: false, header: 'Recently viewed dashboards' },
            { list: [], show: false, header: 'Search' },
        ];
        // update capability
        if (_this.panel.mode) {
            if (_this.panel.mode === 'starred') {
                _this.panel.starred = true;
                _this.panel.headings = false;
            }
            if (_this.panel.mode === 'recently viewed') {
                _this.panel.recent = true;
                _this.panel.starred = false;
                _this.panel.headings = false;
            }
            if (_this.panel.mode === 'search') {
                _this.panel.search = true;
                _this.panel.starred = false;
                _this.panel.headings = false;
            }
            delete _this.panel.mode;
        }
        return _this;
    }
    DashListCtrl.prototype.onInitEditMode = function () {
        this.modes = ['starred', 'search', 'recently viewed'];
        this.addEditorTab('Options', 'public/app/plugins/panel/dashlist/editor.html');
    };
    DashListCtrl.prototype.onRefresh = function () {
        var promises = [];
        promises.push(this.getRecentDashboards());
        promises.push(this.getStarred());
        promises.push(this.getSearch());
        return Promise.all(promises).then(this.renderingCompleted.bind(this));
    };
    DashListCtrl.prototype.getSearch = function () {
        var _this = this;
        this.groups[2].show = this.panel.search;
        if (!this.panel.search) {
            return Promise.resolve();
        }
        var params = {
            limit: this.panel.limit,
            query: this.panel.query,
            tag: this.panel.tags,
            folderIds: this.panel.folderId,
            type: 'dash-db',
        };
        return this.backendSrv.search(params).then(function (result) {
            _this.groups[2].list = result;
        });
    };
    DashListCtrl.prototype.getStarred = function () {
        var _this = this;
        this.groups[0].show = this.panel.starred;
        if (!this.panel.starred) {
            return Promise.resolve();
        }
        var params = { limit: this.panel.limit, starred: 'true' };
        return this.backendSrv.search(params).then(function (result) {
            _this.groups[0].list = result;
        });
    };
    DashListCtrl.prototype.starDashboard = function (dash, evt) {
        this.dashboardSrv.starDashboard(dash.id, dash.isStarred).then(function (newState) {
            dash.isStarred = newState;
        });
        if (evt) {
            evt.stopPropagation();
            evt.preventDefault();
        }
    };
    DashListCtrl.prototype.getRecentDashboards = function () {
        var _this = this;
        this.groups[1].show = this.panel.recent;
        if (!this.panel.recent) {
            return Promise.resolve();
        }
        var dashIds = _.take(impressionSrv.getDashboardOpened(), this.panel.limit);
        return this.backendSrv.search({ dashboardIds: dashIds, limit: this.panel.limit }).then(function (result) {
            _this.groups[1].list = dashIds
                .map(function (orderId) {
                return _.find(result, function (dashboard) {
                    return dashboard.id === orderId;
                });
            })
                .filter(function (el) {
                return el !== undefined;
            });
        });
    };
    DashListCtrl.prototype.onFolderChange = function (folder) {
        this.panel.folderId = folder.id;
        this.refresh();
    };
    DashListCtrl.templateUrl = 'module.html';
    DashListCtrl.scrollable = true;
    return DashListCtrl;
}(PanelCtrl));
export { DashListCtrl, DashListCtrl as PanelCtrl };
//# sourceMappingURL=module.js.map