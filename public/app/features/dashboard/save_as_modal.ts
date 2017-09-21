///<reference path="../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';

const  template = `
<div class="modal-body">
	<div class="modal-header">
		<h2 class="modal-header-title">
			<i class="fa fa-copy"></i>
			<span class="p-l-1">Save As...</span>
		</h2>

		<a class="modal-header-close" ng-click="ctrl.dismiss();">
			<i class="fa fa-remove"></i>
		</a>
	</div>

	<form name="ctrl.saveForm" ng-submit="ctrl.save()" class="modal-content" novalidate>
		<div class="p-t-2">
			<div class="gf-form">
				<label class="gf-form-label">New name</label>
				<input type="text" class="gf-form-input" ng-model="ctrl.clone.title" give-focus="true" required>
			</div>
		</div>

		<div class="gf-form-button-row text-center">
			<button type="submit" class="btn btn-success" ng-disabled="ctrl.saveForm.$invalid">Save</button>
			<a class="btn-text" ng-click="ctrl.dismiss();">Cancel</a>
		</div>
	</form>
</div>
`;

export class SaveDashboardAsModalCtrl {
  clone: any;
  dismiss: () => void;

  /** @ngInject */
  constructor(private $scope, private dashboardSrv) {
    var dashboard = this.dashboardSrv.getCurrent();
    this.clone = dashboard.getSaveModelClone();
    this.clone.id = null;
    this.clone.title += ' Copy';
    this.clone.editable = true;
    this.clone.hideControls = false;

    // remove alerts if source dashboard is already persisted
    // do not want to create alert dupes
    if (dashboard.id > 0) {
      this.clone.rows.forEach(row => {
        row.panels.forEach(panel => {
          delete panel.thresholds;
          delete panel.alert;
        });
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
}

export function saveDashboardAsDirective() {
  return {
    restrict: 'E',
    template: template,
    controller: SaveDashboardAsModalCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {dismiss: "&"}
  };
}

coreModule.directive('saveDashboardAsModal',  saveDashboardAsDirective);
