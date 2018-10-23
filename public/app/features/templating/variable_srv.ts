// Libaries
import angular from 'angular';
import _ from 'lodash';

// Utils & Services
import coreModule from 'app/core/core_module';
import { variableTypes } from './variable';
import { Graph } from 'app/core/utils/dag';

export class VariableSrv {
  dashboard: any;
  variables: any;

  /** @ngInject */
  constructor(private $rootScope, private $q, private $location, private $injector, private templateSrv) {
    $rootScope.$on('template-variable-value-updated', this.updateUrlParamsWithCurrentVariables.bind(this), $rootScope);
  }

  init(dashboard) {
    this.dashboard = dashboard;
    this.dashboard.events.on('time-range-updated', this.onTimeRangeUpdated.bind(this));

    // create working class models representing variables
    this.variables = dashboard.templating.list = dashboard.templating.list.map(this.createVariableFromModel.bind(this));
    this.templateSrv.init(this.variables);

    // init variables
    for (const variable of this.variables) {
      variable.initLock = this.$q.defer();
    }

    const queryParams = this.$location.search();
    return this.$q
      .all(
        this.variables.map(variable => {
          return this.processVariable(variable, queryParams);
        })
      )
      .then(() => {
        this.templateSrv.updateTemplateData();
      });
  }

  onTimeRangeUpdated() {
    const promises = this.variables.filter(variable => variable.refresh === 2).map(variable => {
      const previousOptions = variable.options.slice();

      return variable.updateOptions().then(() => {
        if (angular.toJson(previousOptions) !== angular.toJson(variable.options)) {
          this.$rootScope.$emit('template-variable-value-updated');
        }
      });
    });

    return this.$q.all(promises).then(() => {
      this.dashboard.startRefresh();
    });
  }

  processVariable(variable, queryParams) {
    const dependencies = [];

    for (const otherVariable of this.variables) {
      if (variable.dependsOn(otherVariable)) {
        dependencies.push(otherVariable.initLock.promise);
      }
    }

    return this.$q
      .all(dependencies)
      .then(() => {
        const urlValue = queryParams['var-' + variable.name];
        if (urlValue !== void 0) {
          return variable.setValueFromUrl(urlValue).then(variable.initLock.resolve);
        }

        if (variable.refresh === 1 || variable.refresh === 2) {
          return variable.updateOptions().then(variable.initLock.resolve);
        }

        variable.initLock.resolve();
      })
      .finally(() => {
        this.templateSrv.variableInitialized(variable);
        delete variable.initLock;
      });
  }

  createVariableFromModel(model) {
    const ctor = variableTypes[model.type].ctor;
    if (!ctor) {
      throw {
        message: 'Unable to find variable constructor for ' + model.type,
      };
    }

    const variable = this.$injector.instantiate(ctor, { model: model });
    return variable;
  }

  addVariable(variable) {
    this.variables.push(variable);
    this.templateSrv.updateTemplateData();
    this.dashboard.updateSubmenuVisibility();
  }

  removeVariable(variable) {
    const index = _.indexOf(this.variables, variable);
    this.variables.splice(index, 1);
    this.templateSrv.updateTemplateData();
    this.dashboard.updateSubmenuVisibility();
  }

  updateOptions(variable) {
    return variable.updateOptions();
  }

  variableUpdated(variable, emitChangeEvents?) {
    // if there is a variable lock ignore cascading update because we are in a boot up scenario
    if (variable.initLock) {
      return this.$q.when();
    }

    const g = this.createGraph();
    const node = g.getNode(variable.name);
    let promises = [];
    if (node) {
      promises = node.getOptimizedInputEdges().map(e => {
        return this.updateOptions(this.variables.find(v => v.name === e.inputNode.name));
      });
    }

    return this.$q.all(promises).then(() => {
      if (emitChangeEvents) {
        this.$rootScope.$emit('template-variable-value-updated');
        this.dashboard.startRefresh();
      }
    });
  }

  selectOptionsForCurrentValue(variable) {
    let i, y, value, option;
    const selected: any = [];

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
      variable.current = {};
    }

    if (_.isArray(variable.current.value)) {
      let selected = this.selectOptionsForCurrentValue(variable);

      // if none pick first
      if (selected.length === 0) {
        selected = variable.options[0];
      } else {
        selected = {
          value: _.map(selected, val => {
            return val.value;
          }),
          text: _.map(selected, val => {
            return val.text;
          }).join(' + '),
        };
      }

      return variable.setValue(selected);
    } else {
      const currentOption = _.find(variable.options, {
        text: variable.current.text,
      });
      if (currentOption) {
        return variable.setValue(currentOption);
      } else {
        if (!variable.options.length) {
          return Promise.resolve();
        }
        return variable.setValue(variable.options[0]);
      }
    }
  }

  setOptionFromUrl(variable, urlValue) {
    let promise = this.$q.when();

    if (variable.refresh) {
      promise = variable.updateOptions();
    }

    return promise.then(() => {
      let option = _.find(variable.options, op => {
        return op.text === urlValue || op.value === urlValue;
      });

      let defaultText = urlValue;
      const defaultValue = urlValue;

      if (!option && _.isArray(urlValue)) {
        defaultText = [];

        for (let n = 0; n < urlValue.length; n++) {
          const t = _.find(variable.options, op => {
            return op.value === urlValue[n];
          });

          if (t) {
            defaultText.push(t.text);
          }
        }
      }

      option = option || { text: defaultText, value: defaultValue };
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

  updateUrlParamsWithCurrentVariables() {
    // update url
    const params = this.$location.search();

    // remove variable params
    _.each(params, (value, key) => {
      if (key.indexOf('var-') === 0) {
        delete params[key];
      }
    });

    // add new values
    this.templateSrv.fillVariableValuesForUrl(params);
    // update url
    this.$location.search(params);
  }

  setAdhocFilter(options) {
    let variable = _.find(this.variables, {
      type: 'adhoc',
      datasource: options.datasource,
    });
    if (!variable) {
      variable = this.createVariableFromModel({
        name: 'Filters',
        type: 'adhoc',
        datasource: options.datasource,
      });
      this.addVariable(variable);
    }

    const filters = variable.filters;
    let filter = _.find(filters, { key: options.key, value: options.value });

    if (!filter) {
      filter = { key: options.key, value: options.value };
      filters.push(filter);
    }

    filter.operator = options.operator;
    this.variableUpdated(variable, true);
  }

  createGraph() {
    const g = new Graph();

    this.variables.forEach(v => {
      g.createNode(v.name);
    });

    this.variables.forEach(v1 => {
      this.variables.forEach(v2 => {
        if (v1 === v2) {
          return;
        }

        if (v1.dependsOn(v2)) {
          g.link(v1.name, v2.name);
        }
      });
    });

    return g;
  }
}

coreModule.service('variableSrv', VariableSrv);
