import coreModule from 'app/core/core_module';

const  template = `
<h3 class="dashboard-settings__header">Save As</h3>

<form name="ctrl.saveForm" ng-submit="ctrl.save()" novalidate>
  <div class="p-t-2">
    <div class="gf-form">
      <label class="gf-form-label width-6">New name</label>
      <input type="text" class="gf-form-input max-width-25" ng-model="ctrl.clone.title" give-focus="true" required>
    </div>
    <div class="gf-form">
      <folder-picker initial-folder-id="ctrl.folderId"
                      on-change="ctrl.onFolderChange($folder)"
                      label-class="width-6">
      </folder-picker>
    </div>
  </div>

  <div class="gf-form-button-row">
    <button type="submit" class="btn btn-success" ng-disabled="ctrl.saveForm.$invalid">Save As</button>
  </div>
</form>
`;

export class SaveDashboardAsCtrl {
  clone: any;
  folderId: any;
  dismiss: () => void;

  /** @ngInject */
  constructor(private dashboardSrv) {
    var dashboard = this.dashboardSrv.getCurrent();
    this.clone = dashboard.getSaveModelClone();
    this.clone.id = null;
    this.clone.title += ' Copy';
    this.clone.editable = true;
    this.clone.hideControls = false;
    this.folderId = dashboard.folderId;

    // remove alerts if source dashboard is already persisted
    // do not want to create alert dupes
    if (dashboard.id > 0) {
      this.clone.panels.forEach(panel => {
        if (panel.type === "graph" && panel.alert) {
          delete panel.thresholds;
        }
        delete panel.alert;
      });
    }

    delete this.clone.autoUpdate;
  }

  save() {
    return this.dashboardSrv.save(this.clone).then(this.dismiss);
  }

  keyDown(evt) {
    if (evt.keyCode === 13) {
      this.save();
    }
  }

  onFolderChange(folder) {
    this.clone.folderId = folder.id;
  }
}

export function saveDashboardAsDirective() {
  return {
    restrict: 'E',
    template: template,
    controller: SaveDashboardAsCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {}
  };
}

coreModule.directive('saveDashboardAs',  saveDashboardAsDirective);
