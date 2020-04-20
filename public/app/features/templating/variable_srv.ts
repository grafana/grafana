// Libaries
import angular, { auto, ILocationService, IPromise, IQService } from 'angular';
import _ from 'lodash';
// Utils & Services
import coreModule from 'app/core/core_module';
import { VariableActions, variableTypes } from './types';
import { Graph } from 'app/core/utils/dag';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
// Types
import { AppEvents, TimeRange, UrlQueryMap } from '@grafana/data';
import { CoreEvents } from 'app/types';
import { appEvents, contextSrv } from 'app/core/core';

export class VariableSrv {
  dashboard: DashboardModel;
  variables: any[] = [];

  /** @ngInject */
  constructor(
    private $q: IQService,
    private $location: ILocationService,
    private $injector: auto.IInjectorService,
    private templateSrv: TemplateSrv,
    private timeSrv: TimeSrv
  ) {}

  init(dashboard: DashboardModel) {
    this.dashboard = dashboard;
    this.dashboard.events.on(CoreEvents.timeRangeUpdated, this.onTimeRangeUpdated.bind(this));
    this.dashboard.events.on(
      CoreEvents.templateVariableValueUpdated,
      this.updateUrlParamsWithCurrentVariables.bind(this)
    );

    // create working class models representing variables
    this.variables = dashboard.templating.list = dashboard.templating.list.map(this.createVariableFromModel.bind(this));
    this.templateSrv.init(this.variables, this.timeSrv.timeRange());

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
        this.templateSrv.updateIndex();
        this.templateSrv.setGlobalVariable('__dashboard', {
          value: {
            name: dashboard.title,
            uid: dashboard.uid,
            toString: function() {
              return this.uid;
            },
          },
        });
        this.templateSrv.setGlobalVariable('__org', {
          value: {
            name: contextSrv.user.orgName,
            id: contextSrv.user.id,
            toString: function() {
              return this.id;
            },
          },
        });
      });
  }

  onTimeRangeUpdated(timeRange: TimeRange) {
    this.templateSrv.updateTimeRange(timeRange);
    const promises = this.variables
      .filter(variable => variable.refresh === 2)
      .map(variable => {
        const previousOptions = variable.options.slice();

        return variable.updateOptions().then(() => {
          if (angular.toJson(previousOptions) !== angular.toJson(variable.options)) {
            this.dashboard.templateVariableValueUpdated();
          }
        });
      });

    return this.$q
      .all(promises)
      .then(() => {
        this.dashboard.startRefresh();
      })
      .catch(e => {
        appEvents.emit(AppEvents.alertError, ['Template variable service failed', e.message]);
      });
  }

  processVariable(variable: any, queryParams: any) {
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

  createVariableFromModel(model: any) {
    // @ts-ignore
    const ctor = variableTypes[model.type].ctor;
    if (!ctor) {
      throw {
        message: 'Unable to find variable constructor for ' + model.type,
      };
    }

    const variable = this.$injector.instantiate(ctor, { model: model });
    return variable;
  }

  addVariable(variable: any) {
    this.variables.push(variable);
    this.templateSrv.updateIndex();
    this.dashboard.updateSubmenuVisibility();
  }

  removeVariable(variable: any) {
    const index = _.indexOf(this.variables, variable);
    this.variables.splice(index, 1);
    this.templateSrv.updateIndex();
    this.dashboard.updateSubmenuVisibility();
  }

  updateOptions(variable: any) {
    return variable.updateOptions();
  }

  variableUpdated(variable: any, emitChangeEvents?: any) {
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
        this.dashboard.templateVariableValueUpdated();
        this.dashboard.startRefresh();
      }
    });
  }

  selectOptionsForCurrentValue(variable: any) {
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

  validateVariableSelectionState(variable: any, defaultValue?: string) {
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
          }),
        };
      }

      return variable.setValue(selected);
    } else {
      let option: any = undefined;

      // 1. find the current value
      option = _.find(variable.options, {
        text: variable.current.text,
      });
      if (option) {
        return variable.setValue(option);
      }

      // 2. find the default value
      if (defaultValue) {
        option = _.find(variable.options, {
          text: defaultValue,
        });
        if (option) {
          return variable.setValue(option);
        }
      }

      // 3. use the first value
      if (variable.options) {
        return variable.setValue(variable.options[0]);
      }

      // 4... give up
      return Promise.resolve();
    }
  }

  /**
   * Sets the current selected option (or options) based on the query params in the url. It is possible for values
   * in the url to not match current options of the variable. In that case the variables current value will be still set
   * to that value.
   * @param variable Instance of Variable
   * @param urlValue Value of the query parameter
   */
  setOptionFromUrl(variable: any, urlValue: string | string[]): IPromise<any> {
    let promise = this.$q.when();

    if (variable.refresh) {
      promise = variable.updateOptions();
    }

    return promise.then(() => {
      // Simple case. Value in url matches existing options text or value.
      let option: any = _.find(variable.options, op => {
        return op.text === urlValue || op.value === urlValue;
      });

      // No luck either it is array or value does not exist in the variables options.
      if (!option) {
        let defaultText = urlValue;
        const defaultValue = urlValue;

        if (_.isArray(urlValue)) {
          // Multiple values in the url. We construct text as a list of texts from all matched options.
          defaultText = urlValue.reduce((acc, item) => {
            const t: any = _.find(variable.options, { value: item });
            if (t) {
              acc.push(t.text);
            } else {
              acc.push(item);
            }

            return acc;
          }, []);
        }

        // It is possible that we did not match the value to any existing option. In that case the url value will be
        // used anyway for both text and value.
        option = { text: defaultText, value: defaultValue };
      }

      if (variable.multi) {
        // In case variable is multiple choice, we cast to array to preserve the same behaviour as when selecting
        // the option directly, which will return even single value in an array.
        option = { text: _.castArray(option.text), value: _.castArray(option.value) };
      }

      return variable.setValue(option);
    });
  }

  setOptionAsCurrent(variable: any, option: any) {
    variable.current = _.cloneDeep(option);

    if (_.isArray(variable.current.text) && variable.current.text.length > 0) {
      variable.current.text = variable.current.text.join(' + ');
    } else if (_.isArray(variable.current.value) && variable.current.value[0] !== '$__all') {
      variable.current.text = variable.current.value.join(' + ');
    }

    this.selectOptionsForCurrentValue(variable);
    return this.variableUpdated(variable);
  }

  templateVarsChangedInUrl(vars: UrlQueryMap) {
    const update: Array<Promise<any>> = [];
    for (const v of this.variables) {
      const key = `var-${v.name}`;
      if (vars.hasOwnProperty(key)) {
        if (this.isVariableUrlValueDifferentFromCurrent(v, vars[key])) {
          update.push(v.setValueFromUrl(vars[key]));
        }
      }
    }

    if (update.length) {
      Promise.all(update).then(() => {
        this.dashboard.templateVariableValueUpdated();
        this.dashboard.startRefresh();
      });
    }
  }

  isVariableUrlValueDifferentFromCurrent(variable: VariableActions, urlValue: any) {
    // lodash _.isEqual handles array of value equality checks as well
    return !_.isEqual(variable.getValueForUrl(), urlValue);
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

  setAdhocFilter(options: any) {
    let variable: any = _.find(this.variables, {
      type: 'adhoc',
      datasource: options.datasource,
    } as any);
    if (!variable) {
      variable = this.createVariableFromModel({
        name: 'Filters',
        type: 'adhoc',
        datasource: options.datasource,
      });
      this.addVariable(variable);
    }

    const filters = variable.filters;
    let filter: any = _.find(filters, { key: options.key, value: options.value });

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
