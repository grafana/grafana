import coreModule from 'app/core/core_module';

const template = `
<div class="modal-body">
  <div class="modal-header">
    <h2 class="modal-header-title">
      <i class="fa fa-save"></i>
      <span class="p-l-1">Cannot save provisioned dashboards</span>
    </h2>

    <a class="modal-header-close" ng-click="ctrl.dismiss();">
      <i class="fa fa-remove"></i>
    </a>
  </div>

  <form name="ctrl.saveForm" class="modal-content" novalidate>
    <h6 class="text-center">
      This dashboard cannot be saved from Grafana's UI since it have been
      <a href="http://docs.grafana.org/administration/provisioning/#dashboards">provisioned</a> from
      another source. Please ask your Administrator for more info.
    </h6>
    <div class="p-t-2">
      <div class="gf-form">
        <label class="gf-form-hint">
          <textarea
            type="text"
            name="dashboardJson"
            class="gf-form-input"
            ng-model="ctrl.dashboardJson"
            ng-model-options="{allowInvalid: true}"
            autocomplete="off"
            rows="3" /></textarea>
        </label>
      </div>
    </div>

    <div class="gf-form-button-row text-center">
      <button type="submit" class="btn btn-success" clipboard-button="ctrl.getJsonForClipboard()" >
        <i class="fa fa-clipboard"></i>&nbsp;Copy json
      </button>
      <button class="btn btn-inverse" ng-click="ctrl.dismiss();">Close</button>
    </div>
  </form>
</div>
`;

export class SaveProvisionedDashboardModalCtrl {
  dashboardJson: string;
  dismiss: () => void;

  /** @ngInject */
  constructor(dashboardSrv) {
    var dashboard = dashboardSrv.getCurrent().getSaveModelClone();
    delete dashboard.id;
    this.dashboardJson = JSON.stringify(dashboard);
  }

  getJsonForClipboard() {
    return this.dashboardJson;
  }
}

export function saveProvisionedDashboardModalDirective() {
  return {
    restrict: 'E',
    template: template,
    controller: SaveProvisionedDashboardModalCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: { dismiss: '&' },
  };
}

coreModule.directive('saveProvisionedDashboardModal', saveProvisionedDashboardModalDirective);
