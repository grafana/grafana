import { __awaiter } from "tslib";
import { isString } from 'lodash';
import { PanelEvents, EventBusSrv, } from '@grafana/data';
import { AngularLocationWrapper } from 'app/angular/AngularLocationWrapper';
import config from 'app/core/config';
import { profiler } from 'app/core/core';
export class PanelCtrl {
    constructor($scope, $injector) {
        var _a, _b;
        this.pluginName = '';
        this.pluginId = '';
        this.editModeInitiated = false;
        this.loading = false;
        // overriden from react
        this.onPluginTypeChange = (plugin) => { };
        this.panel = (_a = this.panel) !== null && _a !== void 0 ? _a : $scope.$parent.panel;
        this.dashboard = (_b = this.dashboard) !== null && _b !== void 0 ? _b : $scope.$parent.dashboard;
        this.$injector = $injector;
        this.$scope = $scope;
        this.$timeout = $injector.get('$timeout');
        this.editorTabs = [];
        this.$location = new AngularLocationWrapper();
        this.events = new EventBusSrv();
        this.timing = {}; // not used but here to not break plugins
        const plugin = config.panels[this.panel.type];
        if (plugin) {
            this.pluginId = plugin.id;
            this.pluginName = plugin.name;
        }
        $scope.$on(PanelEvents.componentDidMount.name, () => this.panelDidMount());
    }
    panelDidMount() {
        this.events.emit(PanelEvents.componentDidMount);
        this.events.emit(PanelEvents.initialized);
        this.dashboard.panelInitialized(this.panel);
    }
    renderingCompleted() {
        profiler.renderingCompleted();
    }
    refresh() {
        this.panel.refresh();
    }
    publishAppEvent(event, payload) {
        this.$scope.$root.appEvent(event, payload);
    }
    initEditMode() {
        if (!this.editModeInitiated) {
            this.editModeInitiated = true;
            this.events.emit(PanelEvents.editModeInitialized);
        }
    }
    addEditorTab(title, directiveFn, index, icon) {
        const editorTab = { title, directiveFn, icon };
        if (isString(directiveFn)) {
            editorTab.directiveFn = () => {
                return { templateUrl: directiveFn };
            };
        }
        if (index) {
            this.editorTabs.splice(index, 0, editorTab);
        }
        else {
            this.editorTabs.push(editorTab);
        }
    }
    getExtendedMenu() {
        const menu = [];
        this.events.emit(PanelEvents.initPanelActions, menu);
        return menu;
    }
    // Override in sub-class to add items before extended menu
    getAdditionalMenuItems() {
        return __awaiter(this, void 0, void 0, function* () {
            return [];
        });
    }
    otherPanelInFullscreenMode() {
        return this.dashboard.otherPanelInFullscreen(this.panel);
    }
    render(payload) {
        this.events.emit(PanelEvents.render, payload);
    }
}
//# sourceMappingURL=panel_ctrl.js.map