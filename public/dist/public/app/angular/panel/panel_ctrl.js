import { __awaiter, __generator } from "tslib";
import { isString } from 'lodash';
import config from 'app/core/config';
import { profiler } from 'app/core/core';
import { PanelEvents, EventBusSrv, } from '@grafana/data';
import { AngularLocationWrapper } from 'app/angular/AngularLocationWrapper';
var PanelCtrl = /** @class */ (function () {
    function PanelCtrl($scope, $injector) {
        var _this = this;
        var _a, _b;
        this.pluginName = '';
        this.pluginId = '';
        this.editModeInitiated = false;
        this.loading = false;
        // overriden from react
        this.onPluginTypeChange = function (plugin) { };
        this.panel = (_a = this.panel) !== null && _a !== void 0 ? _a : $scope.$parent.panel;
        this.dashboard = (_b = this.dashboard) !== null && _b !== void 0 ? _b : $scope.$parent.dashboard;
        this.$injector = $injector;
        this.$scope = $scope;
        this.$timeout = $injector.get('$timeout');
        this.editorTabs = [];
        this.$location = new AngularLocationWrapper();
        this.events = new EventBusSrv();
        this.timing = {}; // not used but here to not break plugins
        var plugin = config.panels[this.panel.type];
        if (plugin) {
            this.pluginId = plugin.id;
            this.pluginName = plugin.name;
        }
        $scope.$on(PanelEvents.componentDidMount.name, function () { return _this.panelDidMount(); });
    }
    PanelCtrl.prototype.panelDidMount = function () {
        this.events.emit(PanelEvents.componentDidMount);
        this.events.emit(PanelEvents.initialized);
        this.dashboard.panelInitialized(this.panel);
    };
    PanelCtrl.prototype.renderingCompleted = function () {
        profiler.renderingCompleted();
    };
    PanelCtrl.prototype.refresh = function () {
        this.panel.refresh();
    };
    PanelCtrl.prototype.publishAppEvent = function (event, payload) {
        this.$scope.$root.appEvent(event, payload);
    };
    PanelCtrl.prototype.initEditMode = function () {
        if (!this.editModeInitiated) {
            this.editModeInitiated = true;
            this.events.emit(PanelEvents.editModeInitialized);
        }
    };
    PanelCtrl.prototype.addEditorTab = function (title, directiveFn, index, icon) {
        var editorTab = { title: title, directiveFn: directiveFn, icon: icon };
        if (isString(directiveFn)) {
            editorTab.directiveFn = function () {
                return { templateUrl: directiveFn };
            };
        }
        if (index) {
            this.editorTabs.splice(index, 0, editorTab);
        }
        else {
            this.editorTabs.push(editorTab);
        }
    };
    PanelCtrl.prototype.getExtendedMenu = function () {
        var menu = [];
        this.events.emit(PanelEvents.initPanelActions, menu);
        return menu;
    };
    // Override in sub-class to add items before extended menu
    PanelCtrl.prototype.getAdditionalMenuItems = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, []];
            });
        });
    };
    PanelCtrl.prototype.otherPanelInFullscreenMode = function () {
        return this.dashboard.otherPanelInFullscreen(this.panel);
    };
    PanelCtrl.prototype.render = function (payload) {
        this.events.emit(PanelEvents.render, payload);
    };
    return PanelCtrl;
}());
export { PanelCtrl };
//# sourceMappingURL=panel_ctrl.js.map