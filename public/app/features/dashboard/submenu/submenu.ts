///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class SubmenuCtrl {
  annotations: any;
  variables: any;
  dashboard: any;

  /** @ngInject */
  constructor(private $rootScope,
              private templateValuesSrv,
              private templateSrv,
              private $location) {
    this.annotations = this.dashboard.templating.list;
    this.variables = this.dashboard.templating.list;
  }

  disableAnnotation(annotation) {
    annotation.enable = !annotation.enable;
    this.$rootScope.$broadcast('refresh');
  }

  getValuesForTag(variable, tagKey) {
    return this.templateValuesSrv.getValuesForTag(variable, tagKey);
  }

  updateUrlParamsWithCurrentVariables() {
    // update url
    var params = this.$location.search();
    // remove variable params
    _.each(params, function(value, key) {
      if (key.indexOf('var-') === 0) {
        delete params[key];
      }
    });

    // add new values
    this.templateSrv.fillVariableValuesForUrl(params);
    // update url
    this.$location.search(params);
  }

  variableUpdated(variable) {
    this.templateValuesSrv.variableUpdated(variable).then(() => {
      this.updateUrlParamsWithCurrentVariables();
      this.$rootScope.$emit('template-variable-value-updated');
      this.$rootScope.$broadcast('refresh');
    });
  }
}

export function submenuDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/submenu/submenu.html',
    controller: SubmenuCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: "=",
    }
  };
}

angular.module('grafana.directives').directive('dashboardSubmenu', submenuDirective);
