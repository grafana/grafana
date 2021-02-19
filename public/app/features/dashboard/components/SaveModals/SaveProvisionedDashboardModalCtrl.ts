import angular from 'angular';
import { saveAs } from 'file-saver';
import coreModule from 'app/core/core_module';
import { DashboardModel } from '../../state';
import { DashboardSrv } from '../../services/DashboardSrv';

const template = `
<div class="modal-body">
  <div class="modal-header">
    <h2 class="modal-header-title">
      <i class="fa fa-save"></i><span class="p-l-1">Cannot save provisioned dashboard</span>
    </h2>

    <a class="modal-header-close" ng-click="ctrl.dismiss();">
      <i class="fa fa-remove"></i>
    </a>
  </div>

  <div class="modal-content">
    <small>
      This dashboard cannot be saved from Grafana's UI since it has been provisioned from another source.
      Copy the JSON or save it to a file below. Then you can update your dashboard in corresponding provisioning source.<br/>
      <i>See <a class="external-link" href="http://docs.grafana.org/administration/provisioning/#dashboards" target="_blank">
      documentation</a> for more information about provisioning.</i>
    </small>
    <div class="p-t-1">
      File path: {{ctrl.dashboardModel.meta.provisionedExternalId}}
    </div>
    <div class="p-t-2">
      <div class="gf-form">
        <code-editor content="ctrl.dashboardJson" data-mode="json" data-max-lines=15></code-editor>
      </div>
      <div class="gf-form-button-row">
        <button class="btn btn-primary" clipboard-button="ctrl.getJsonForClipboard()">
          Copy JSON to Clipboard
        </button>
        <button class="btn btn-secondary" clipboard-button="ctrl.save()">
          Save JSON to file
        </button>
        <a class="btn btn-link" ng-click="ctrl.dismiss();">Cancel</a>
      </div>
    </div>
  </div>
</div>
`;

export class SaveProvisionedDashboardModalCtrl {
  dash: any;
  dashboardModel: DashboardModel;
  dashboardJson: string;
  dismiss: () => void;

  /** @ngInject */
  constructor(dashboardSrv: DashboardSrv) {
    this.dashboardModel = dashboardSrv.getCurrent();
    this.dash = this.dashboardModel.getSaveModelClone();
    delete this.dash.id;
    this.dashboardJson = angular.toJson(this.dash, true);
  }

  save() {
    const blob = new Blob([angular.toJson(this.dash, true)], {
      type: 'application/json;charset=utf-8',
    });
    saveAs(blob, this.dash.title + '-' + new Date().getTime() + '.json');
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
