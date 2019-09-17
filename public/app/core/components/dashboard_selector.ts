import coreModule from 'app/core/core_module';
import { BackendSrv } from '../services/backend_srv';

const template = `
<select class="gf-form-input" ng-model="ctrl.model" ng-options="f.value as f.text for f in ctrl.options"></select>
`;

export class DashboardSelectorCtrl {
  model: any;
  options: any;

  /** @ngInject */
  constructor(private backendSrv: BackendSrv) {}

  $onInit() {
    this.options = [{ value: 0, text: 'Default' }];

    return this.backendSrv.search({ starred: true }).then(res => {
      res.forEach(dash => {
        this.options.push({ value: dash.id, text: dash.title });
      });
    });
  }
}

export function dashboardSelector() {
  return {
    restrict: 'E',
    controller: DashboardSelectorCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    template: template,
    scope: {
      model: '=',
    },
  };
}

coreModule.directive('dashboardSelector', dashboardSelector);
