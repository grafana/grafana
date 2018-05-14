import coreModule from 'app/core/core_module';
import _ from 'lodash';

const template = `
<div class="modal-body">
  <div class="modal-header">
    <h2 class="modal-header-title">
      <i class="fa fa-save"></i>
      <span class="p-l-1">Save changes</span>
    </h2>

    <a class="modal-header-close" ng-click="ctrl.dismiss();">
      <i class="fa fa-remove"></i>
    </a>
  </div>

  <form name="ctrl.saveForm" ng-submit="ctrl.save()" class="modal-content" novalidate>
    <div class="p-t-2">
      <div class="gf-form-group">
		    <gf-form-switch class="gf-form"
			    label="Save current time range" ng-if="ctrl.compareTime()" label-class="width-12" switch-class="max-width-6"
			    checked="ctrl.saveTimerange" on-change="buildUrl()">
		    </gf-form-switch>
		    <gf-form-switch class="gf-form"
			    label="Save current variables" ng-if="ctrl.compareTemplating()" label-class="width-12" switch-class="max-width-6"
			    checked="ctrl.saveVariables" on-change="buildUrl()">
		    </gf-form-switch>
	    </div>
      <div class="gf-form">
        <label class="gf-form-hint">
          <input
            type="text"
            name="message"
            class="gf-form-input"
            placeholder="Add a note to describe your changes &hellip;"
            give-focus="true"
            ng-model="ctrl.message"
            ng-model-options="{allowInvalid: true}"
            ng-maxlength="this.max"
            autocomplete="off" />
          <small class="gf-form-hint-text muted" ng-cloak>
            <span ng-class="{'text-error': ctrl.saveForm.message.$invalid && ctrl.saveForm.message.$dirty }">
              {{ctrl.message.length || 0}}
            </span>
            / {{ctrl.max}} characters
          </small>
        </label>
      </div>
    </div>

    <div class="gf-form-button-row text-center">
      <button type="submit" class="btn btn-success" ng-disabled="ctrl.saveForm.$invalid">Save</button>
      <a class="btn btn-link" ng-click="ctrl.dismiss();">Cancel</a>
    </div>
  </form>
</div>
`;

export class SaveDashboardModalCtrl {
  message: string;
  saveVariables = false;
  saveTimerange = false;
  templating: any;
  time: any;
  originalTime: any;
  current = [];
  originalCurrent = [];
  max: number;
  saveForm: any;
  dismiss: () => void;

  /** @ngInject */
  constructor(private dashboardSrv) {
    console.log(dashboardSrv);
    this.message = '';
    this.max = 64;
    this.templating = dashboardSrv.dash.templating.list;
  }

  compareTime() {
    _.isEqual(this.dashboardSrv.dash.time, this.dashboardSrv.dash.originalTime);
  }

  compareTemplating() {
    if (this.dashboardSrv.dash.templating.list.length > 0) {
      for (let i = 0; i < this.dashboardSrv.dash.templating.list.length; i++) {
        if (
          this.dashboardSrv.dash.templating.list[i].current.text !==
          this.dashboardSrv.dash.originalTemplating[i].current.text
        ) {
          return true;
        }
      }
      return false;
    } else {
      return false;
    }
  }

  save() {
    if (!this.saveForm.$valid) {
      return;
    }

    var options = {
      saveVariables: this.saveVariables,
      saveTimerange: this.saveTimerange,
      message: this.message,
    };

    var dashboard = this.dashboardSrv.getCurrent();
    var saveModel = dashboard.getSaveModelClone(options);

    return this.dashboardSrv.save(saveModel, options).then(this.dismiss);
  }
}

export function saveDashboardModalDirective() {
  return {
    restrict: 'E',
    template: template,
    controller: SaveDashboardModalCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: { dismiss: '&' },
  };
}

coreModule.directive('saveDashboardModal', saveDashboardModalDirective);
