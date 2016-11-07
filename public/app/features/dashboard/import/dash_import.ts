///<reference path="../../../headers/common.d.ts" />

import kbn from 'app/core/utils/kbn';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';
import _ from 'lodash';

export class DashImportCtrl {
  step: number;
  jsonText: string;
  parseError: string;
  nameExists: boolean;
  dash: any;
  inputs: any[];
  inputsValid: boolean;
  gnetUrl: string;
  gnetError: string;
  gnetInfo: any;

  /** @ngInject */
  constructor(private backendSrv, private $location, private $scope, private $routeParams) {
    this.step = 1;
    this.nameExists = false;

    // check gnetId in url
    if ($routeParams.gnetId)  {
      this.gnetUrl = $routeParams.gnetId ;
      this.checkGnetDashboard();
    }
  }

  onUpload(dash) {
    this.dash = dash;
    this.dash.id = null;
    this.step = 2;
    this.inputs = [];

    if (this.dash.__inputs) {
      for (let input of this.dash.__inputs) {
        var inputModel = {
          name: input.name,
          label: input.label,
          info: input.description,
          value: input.value,
          type: input.type,
          pluginId: input.pluginId,
          options: []
        };

        if (input.type === 'datasource') {
          this.setDatasourceOptions(input, inputModel);
        } else if (!inputModel.info) {
          inputModel.info = 'Specify a string constant';
        }

        this.inputs.push(inputModel);
      }
    }

    this.inputsValid = this.inputs.length === 0;
    this.titleChanged();
  }

  setDatasourceOptions(input, inputModel) {
    var sources = _.filter(config.datasources, val => {
      return val.type === input.pluginId;
    });

    if (sources.length === 0) {
      inputModel.info = "No data sources of type " + input.pluginName + " found";
    } else if (!inputModel.info) {
      inputModel.info = "Select a " + input.pluginName + " data source";
    }

    inputModel.options = sources.map(val => {
      return {text: val.name, value: val.name};
    });
  }

  inputValueChanged() {
    this.inputsValid = true;
    for (let input of this.inputs) {
      if (!input.value) {
        this.inputsValid = false;
      }
    }
  }

  titleChanged() {
    this.backendSrv.search({query: this.dash.title}).then(res => {
      this.nameExists = false;
      for (let hit of res) {
        if (this.dash.title === hit.title) {
          this.nameExists = true;
          break;
        }
      }
    });
  }

  saveDashboard() {
    var inputs = this.inputs.map(input => {
      return {
        name: input.name,
        type: input.type,
        pluginId: input.pluginId,
        value: input.value
      };
    });

    return this.backendSrv.post('api/dashboards/import', {
      dashboard: this.dash,
      overwrite: true,
      inputs: inputs
    }).then(res => {
      this.$location.url('dashboard/' + res.importedUri);
      this.$scope.dismiss();
    });
  }

  loadJsonText() {
    try {
      this.parseError = '';
      var dash = JSON.parse(this.jsonText);
      this.onUpload(dash);
    } catch (err) {
      console.log(err);
      this.parseError = err.message;
      return;
    }
  }

  checkGnetDashboard() {
    this.gnetError = '';

    var match = /(^\d+$)|dashboards\/(\d+)/.exec(this.gnetUrl);
    var dashboardId;

    if (match && match[1]) {
      dashboardId = match[1];
    } else if (match && match[2]) {
      dashboardId = match[2];
    } else {
      this.gnetError = 'Could not find dashboard';
    }

    return this.backendSrv.get('api/gnet/dashboards/' + dashboardId).then(res => {
      this.gnetInfo = res;
      // store reference to grafana.net
      res.json.gnetId = res.id;
      this.onUpload(res.json);
    }).catch(err => {
      err.isHandled = true;
      this.gnetError = err.data.message || err;
    });
  }

  back() {
    this.gnetUrl = '';
    this.step = 1;
    this.gnetError = '';
    this.gnetInfo = '';
  }

}

export function dashImportDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/import/dash_import.html',
    controller: DashImportCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
  };
}

coreModule.directive('dashImport', dashImportDirective);
