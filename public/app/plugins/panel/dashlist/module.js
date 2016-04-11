///<reference path="../../../headers/common.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var lodash_1 = require('lodash');
var sdk_1 = require('app/plugins/sdk');
var impression_store_1 = require('app/features/dashboard/impression_store');
// Set and populate defaults
var panelDefaults = {
    mode: 'starred',
    query: '',
    limit: 10,
    tags: [],
    recent: false,
    search: false,
    starred: true
};
var DashListCtrl = (function (_super) {
    __extends(DashListCtrl, _super);
    /** @ngInject */
    function DashListCtrl($scope, $injector, backendSrv) {
        _super.call(this, $scope, $injector);
        this.backendSrv = backendSrv;
        lodash_1["default"].defaults(this.panel, panelDefaults);
        if (this.panel.tag) {
            this.panel.tags = [this.panel.tag];
            delete this.panel.tag;
        }
        this.events.on('refresh', this.onRefresh.bind(this));
        this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    }
    DashListCtrl.prototype.onInitEditMode = function () {
        this.editorTabIndex = 1;
        this.modes = ['starred', 'search', 'recently viewed'];
        this.addEditorTab('Options', 'public/app/plugins/panel/dashlist/editor.html');
    };
    DashListCtrl.prototype.onRefresh = function () {
        var promises = [];
        if (this.panel.recent) {
            promises.push(this.getRecentDashboards());
        }
        if (this.panel.starred) {
            promises.push(this.getStarred());
        }
        if (this.panel.search) {
            promises.push(this.getSearch());
        }
        return Promise.all(promises)
            .then(this.renderingCompleted.bind(this));
    };
    DashListCtrl.prototype.getSearch = function () {
        var _this = this;
        var params = {
            limit: this.panel.limit,
            query: this.panel.query,
            tag: this.panel.tags
        };
        return this.backendSrv.search(params).then(function (result) {
            _this.dashList = result;
            _this.renderingCompleted();
        });
    };
    DashListCtrl.prototype.getStarred = function () {
        var _this = this;
        var params = { limit: this.panel.limit, starred: "true" };
        return this.backendSrv.search(params).then(function (result) {
            _this.dashList = result;
            _this.renderingCompleted();
        });
    };
    DashListCtrl.prototype.getRecentDashboards = function () {
        var _this = this;
        var dashIds = lodash_1["default"].first(impression_store_1.impressions.getDashboardOpened(), this.panel.limit);
        return this.backendSrv.search({ dashboardIds: dashIds, limit: this.panel.limit }).then(function (result) {
            _this.dashList = dashIds.map(function (orderId) {
                return lodash_1["default"].find(result, function (dashboard) {
                    return dashboard.id === orderId;
                });
            }).filter(function (el) {
                return el !== undefined;
            });
        });
    };
    DashListCtrl.templateUrl = 'module.html';
    return DashListCtrl;
}(sdk_1.PanelCtrl));
exports.DashListCtrl = DashListCtrl;
exports.PanelCtrl = DashListCtrl;
