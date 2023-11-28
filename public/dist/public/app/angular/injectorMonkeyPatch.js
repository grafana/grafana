export function monkeyPatchInjectorWithPreAssignedBindings(injector) {
    injector.oldInvoke = injector.invoke;
    injector.invoke = (fn, self, locals, serviceName) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const parentScope = (_a = locals === null || locals === void 0 ? void 0 : locals.$scope) === null || _a === void 0 ? void 0 : _a.$parent;
        if (parentScope) {
            // PanelCtrl
            if (parentScope.panel) {
                self.panel = parentScope.panel;
            }
            // Panels & dashboard SettingsCtrl
            if (parentScope.dashboard) {
                self.dashboard = parentScope.dashboard;
            }
            // Query editors
            if ((_b = parentScope.ctrl) === null || _b === void 0 ? void 0 : _b.target) {
                self.panelCtrl = parentScope.ctrl;
                self.datasource = parentScope.ctrl.datasource;
                self.target = parentScope.ctrl.target;
            }
            // Data source ConfigCtrl
            if ((_c = parentScope.ctrl) === null || _c === void 0 ? void 0 : _c.datasourceMeta) {
                self.meta = parentScope.ctrl.datasourceMeta;
                self.current = parentScope.ctrl.current;
            }
            // Data source AnnotationsQueryCtrl
            if ((_d = parentScope.ctrl) === null || _d === void 0 ? void 0 : _d.currentAnnotation) {
                self.annotation = parentScope.ctrl.currentAnnotation;
                self.datasource = parentScope.ctrl.currentDatasource;
            }
            // App config ctrl
            if (parentScope.isAppConfigCtrl) {
                self.appEditCtrl = parentScope.ctrl;
                self.appModel = parentScope.ctrl.model;
            }
            // App page ctrl
            if ((_g = (_f = (_e = parentScope.$parent) === null || _e === void 0 ? void 0 : _e.$parent) === null || _f === void 0 ? void 0 : _f.ctrl) === null || _g === void 0 ? void 0 : _g.appModel) {
                self.appModel = (_k = (_j = (_h = parentScope.$parent) === null || _h === void 0 ? void 0 : _h.$parent) === null || _j === void 0 ? void 0 : _j.ctrl) === null || _k === void 0 ? void 0 : _k.appModel;
            }
        }
        return injector.oldInvoke(fn, self, locals, serviceName);
    };
}
//# sourceMappingURL=injectorMonkeyPatch.js.map