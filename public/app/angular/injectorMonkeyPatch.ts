export function monkeyPatchInjectorWithPreAssignedBindings(injector: any) {
  injector.oldInvoke = injector.invoke;
  injector.invoke = (fn: any, self: any, locals: any, serviceName: any) => {
    const parentScope = locals?.$scope?.$parent;

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
      if (parentScope.ctrl?.target) {
        self.panelCtrl = parentScope.ctrl;
        self.datasource = parentScope.ctrl.datasource;
        self.target = parentScope.ctrl.target;
      }

      // Data source ConfigCtrl
      if (parentScope.ctrl?.datasourceMeta) {
        self.meta = parentScope.ctrl.datasourceMeta;
        self.current = parentScope.ctrl.current;
      }

      // Data source AnnotationsQueryCtrl
      if (parentScope.ctrl?.currentAnnotation) {
        self.annotation = parentScope.ctrl.currentAnnotation;
        self.datasource = parentScope.ctrl.currentDatasource;
      }

      // App config ctrl
      if (parentScope.isAppConfigCtrl) {
        self.appEditCtrl = parentScope.ctrl;
        self.appModel = parentScope.ctrl.model;
      }

      // App page ctrl
      if (parentScope.$parent?.$parent?.ctrl?.appModel) {
        self.appModel = parentScope.$parent?.$parent?.ctrl?.appModel;
      }
    }

    return injector.oldInvoke(fn, self, locals, serviceName);
  };
}
