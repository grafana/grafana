import coreModule from 'app/core/core_module';

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
    <div class="p-t-1">
      <div class="gf-form-group" ng-if="ctrl.timeChange || ctrl.variableValueChange">
		    <gf-form-switch class="gf-form"
			    label="Save current time range" ng-if="ctrl.timeChange" label-class="width-12" switch-class="max-width-6"
			    checked="ctrl.saveTimerange" on-change="buildUrl()">
		    </gf-form-switch>
		    <gf-form-switch class="gf-form"
			    label="Save current variables" ng-if="ctrl.variableValueChange" label-class="width-12" switch-class="max-width-6"
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
            maxlength="64"
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
      <button
        id="saveBtn"
        type="submit"
        class="btn btn-success"
        ng-class="{'btn-success--processing': ctrl.isSaving}"
        ng-disabled="ctrl.saveForm.$invalid || ctrl.isSaving"
      >
        <span ng-if="!ctrl.isSaving">Save</span>
        <span ng-if="ctrl.isSaving === true">Saving...</span>
      </button>
      <button class="btn btn-inverse" ng-click="ctrl.dismiss();">Cancel</button>
    </div>
  </form>
</div>
`;

export class SaveDashboardModalCtrl {
  message: string;
  saveVariables = false;
  saveTimerange = false;
  time: any;
  originalTime: any;
  current = [];
  originalCurrent = [];
  max: number;
  saveForm: any;
  isSaving: boolean;
  dismiss: () => void;
  timeChange = false;
  variableValueChange = false;

  /** @ngInject */
  constructor(private dashboardSrv) {
    this.message = '';
    this.max = 64;
    this.isSaving = false;
    this.timeChange = this.dashboardSrv.getCurrent().hasTimeChanged();
    this.variableValueChange = this.dashboardSrv.getCurrent().hasVariableValuesChanged();
  }

  save() {
    if (!this.saveForm.$valid) {
      return;
    }

    const options = {
      saveVariables: this.saveVariables,
      saveTimerange: this.saveTimerange,
      message: this.message,
    };

    const dashboard = this.dashboardSrv.getCurrent();
    const saveModel = dashboard.getSaveModelClone(options);

    this.isSaving = true;

    return this.dashboardSrv.save(saveModel, options).then(this.postSave.bind(this, options));
  }

  postSave(options) {
    if (options.saveVariables) {
      this.dashboardSrv.getCurrent().resetOriginalVariables();
    }

    if (options.saveTimerange) {
      this.dashboardSrv.getCurrent().resetOriginalTime();
    }

    this.dismiss();
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
