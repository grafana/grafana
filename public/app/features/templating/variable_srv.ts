///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import kbn from 'app/core/utils/kbn';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import {IntervalVariable} from './interval_variable';
import {Variable} from './variable';

export var variableConstructorMap: any = {};

export class VariableSrv {
  dashboard: any;
  variables: any;

  variableLock: any;

  /** @ngInject */
  constructor(
    private $rootScope,
    private $q,
    private $location,
    private $injector,
    private templateSrv) {
    }

    init(dashboard) {
      this.variableLock = {};
      this.dashboard = dashboard;
      this.variables = [];

      dashboard.templating.list.map(this.addVariable.bind(this));
      this.templateSrv.init(this.variables);

      var queryParams = this.$location.search();

      for (let variable of this.variables) {
        this.variableLock[variable.name] = this.$q.defer();
      }

      return this.$q.all(this.variables.map(variable => {
        return this.processVariable(variable, queryParams);
      }));
    }

    processVariable(variable, queryParams) {
      var dependencies = [];
      var lock = this.variableLock[variable.name];

      for (let otherVariable of this.variables) {
        if (variable.dependsOn(otherVariable)) {
          dependencies.push(this.variableLock[otherVariable.name].promise);
        }
      }

      return this.$q.all(dependencies).then(() => {
        var urlValue = queryParams['var-' + variable.name];
        if (urlValue !== void 0) {
          return variable.setValueFromUrl(urlValue).then(lock.resolve);
        }
        if (variable.refresh === 1 || variable.refresh === 2) {
          return variable.updateOptions().then(() => {
            // if (_.isEmpty(variable.current) && variable.options.length) {
            //   self.setVariableValue(variable, variable.options[0]);
            // }
            lock.resolve();
          });
        }

        lock.resolve();
      }).finally(() => {
        delete this.variableLock[variable.name];
      });
    }

    addVariable(model) {
      var ctor = variableConstructorMap[model.type];
      if (!ctor) {
        throw "Unable to find variable constructor for " + model.type;
      }

      var variable = this.$injector.instantiate(ctor, {model: model});
      this.variables.push(variable);
      this.dashboard.templating.list.push(model);

      return variable;
    }

    updateOptions(variable) {
      return variable.updateOptions();
    }

    variableUpdated(variable) {
      // if there is a variable lock ignore cascading update because we are in a boot up scenario
      if (this.variableLock[variable.name]) {
        return this.$q.when();
      }

      // cascade updates to variables that use this variable
      var promises = _.map(this.variables, otherVariable => {
        if (otherVariable === variable) {
          return;
        }

        if (otherVariable.dependsOn(variable)) {
          return this.updateOptions(otherVariable);
        }
      });

      return this.$q.all(promises);
    }

    selectOptionsForCurrentValue(variable) {
      var i, y, value, option;
      var selected: any = [];

      for (i = 0; i < variable.options.length; i++) {
        option = variable.options[i];
        option.selected = false;
        if (_.isArray(variable.current.value)) {
          for (y = 0; y < variable.current.value.length; y++) {
            value = variable.current.value[y];
            if (option.value === value) {
              option.selected = true;
              selected.push(option);
            }
          }
        } else if (option.value === variable.current.value) {
          option.selected = true;
          selected.push(option);
        }
      }

      return selected;
    }

    validateVariableSelectionState(variable) {
      if (!variable.current) {
        if (!variable.options.length) { return this.$q.when(); }
        return variable.setValue(variable.options[0]);
      }

      if (_.isArray(variable.current.value)) {
        var selected = this.selectOptionsForCurrentValue(variable);

        // if none pick first
        if (selected.length === 0) {
          selected = variable.options[0];
        } else {
          selected = {
            value: _.map(selected, function(val) {return val.value;}),
            text: _.map(selected, function(val) {return val.text;}).join(' + '),
          };
        }

        return variable.setValue(selected);
      } else {
        var currentOption = _.find(variable.options, {text: variable.current.text});
        if (currentOption) {
          return variable.setValue(currentOption);
        } else {
          if (!variable.options.length) { return Promise.resolve(); }
          return variable.setValue(variable.options[0]);
        }
      }
    }

    setOptionFromUrl(variable, urlValue) {
      var promise = this.$q.when();

      if (variable.refresh) {
        promise = variable.updateOptions();
      }

      return promise.then(() => {
        var option = _.find(variable.options, op => {
          return op.text === urlValue || op.value === urlValue;
        });

        option = option || {text: urlValue, value: urlValue};
        return variable.setValue(option);
      });
    }

    setOptionAsCurrent(variable, option) {
      variable.current = _.cloneDeep(option);

      if (_.isArray(variable.current.text)) {
        variable.current.text = variable.current.text.join(' + ');
      }

      this.selectOptionsForCurrentValue(variable);
      return this.variableUpdated(variable);
    }
}

coreModule.service('variableSrv', VariableSrv);
