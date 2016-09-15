///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

interface Variable {
}

class ConstantVariable implements Variable {
  constructor(private model) {
  }
}

class CustomVariable implements Variable {
  constructor(private model) {
  }
}

class IntervalVariable implements Variable {
  constructor(private model) {
  }
}


class QueryVariable implements Variable {

  constructor(private model,
              private variableSrv: VariableSrv,
              private datasourceSrv)  {
    _.extend(this, model);
  }

  updateOptions() {
    return this.datasourceSrv.get(this.datasource)
        .then(_.partial(this.updateOptionsFromMetricFindQuery, variable))
        .then(_.partial(this.updateTags, variable))
        .then(_.partial(this.validateVariableSelectionState, variable));
  }
}

class DatasourceVariable implements Variable {
  constructor(private model) {
  }
}


export class VariableSrv {
  dashboard: any;
  variables: any;

  variableLock: any;

  /** @ngInject */
  constructor(
    private $q,
    private $rootScope,
    private datasourceSrv,
    private $location,
    private templateSrv,
    private timeSrv) {

  }

  init(dashboard) {
    this.variableLock = {};
    this.dashboard = dashboard;

    this.variables = dashboard.templating.list.map(item => {
      return new QueryVariable(item, this);
    });

    this.templateSrv.init(this.variables);
    return this.$q.when();
  }

  updateOptions(variable) {
    return variable.updateOptions();
  }

  variableUpdated(variable) {
    // if there is a variable lock ignore cascading update because we are in a boot up scenario
    if (this.variableLock[variable.name]) {
      return this.$q.when();
    }

    var promises = _.map(this.variables, otherVariable => {
      if (otherVariable === variable) {
        return;
      }

      if (this.templateSrv.containsVariable(otherVariable.regex, variable.name) ||
          this.templateSrv.containsVariable(otherVariable.query, variable.name) ||
          this.templateSrv.containsVariable(otherVariable.datasource, variable.name)) {
          return this.updateOptions(otherVariable);
        }
    });

    return this.$q.all(promises);
  }


}

coreModule.service('variableSrv', VariableSrv);
