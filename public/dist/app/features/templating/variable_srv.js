import * as tslib_1 from "tslib";
// Libaries
import angular from 'angular';
import _ from 'lodash';
// Utils & Services
import coreModule from 'app/core/core_module';
import { variableTypes } from './variable';
import { Graph } from 'app/core/utils/dag';
var VariableSrv = /** @class */ (function () {
    /** @ngInject */
    function VariableSrv($q, $location, $injector, templateSrv, timeSrv) {
        this.$q = $q;
        this.$location = $location;
        this.$injector = $injector;
        this.templateSrv = templateSrv;
        this.timeSrv = timeSrv;
    }
    VariableSrv.prototype.init = function (dashboard) {
        var _this = this;
        var e_1, _a;
        this.dashboard = dashboard;
        this.dashboard.events.on('time-range-updated', this.onTimeRangeUpdated.bind(this));
        this.dashboard.events.on('template-variable-value-updated', this.updateUrlParamsWithCurrentVariables.bind(this));
        // create working class models representing variables
        this.variables = dashboard.templating.list = dashboard.templating.list.map(this.createVariableFromModel.bind(this));
        this.templateSrv.init(this.variables, this.timeSrv.timeRange());
        try {
            // init variables
            for (var _b = tslib_1.__values(this.variables), _c = _b.next(); !_c.done; _c = _b.next()) {
                var variable = _c.value;
                variable.initLock = this.$q.defer();
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        var queryParams = this.$location.search();
        return this.$q
            .all(this.variables.map(function (variable) {
            return _this.processVariable(variable, queryParams);
        }))
            .then(function () {
            _this.templateSrv.updateIndex();
        });
    };
    VariableSrv.prototype.onTimeRangeUpdated = function (timeRange) {
        var _this = this;
        this.templateSrv.updateTimeRange(timeRange);
        var promises = this.variables
            .filter(function (variable) { return variable.refresh === 2; })
            .map(function (variable) {
            var previousOptions = variable.options.slice();
            return variable.updateOptions().then(function () {
                if (angular.toJson(previousOptions) !== angular.toJson(variable.options)) {
                    _this.dashboard.templateVariableValueUpdated();
                }
            });
        });
        return this.$q.all(promises).then(function () {
            _this.dashboard.startRefresh();
        });
    };
    VariableSrv.prototype.processVariable = function (variable, queryParams) {
        var _this = this;
        var e_2, _a;
        var dependencies = [];
        try {
            for (var _b = tslib_1.__values(this.variables), _c = _b.next(); !_c.done; _c = _b.next()) {
                var otherVariable = _c.value;
                if (variable.dependsOn(otherVariable)) {
                    dependencies.push(otherVariable.initLock.promise);
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return this.$q
            .all(dependencies)
            .then(function () {
            var urlValue = queryParams['var-' + variable.name];
            if (urlValue !== void 0) {
                return variable.setValueFromUrl(urlValue).then(variable.initLock.resolve);
            }
            if (variable.refresh === 1 || variable.refresh === 2) {
                return variable.updateOptions().then(variable.initLock.resolve);
            }
            variable.initLock.resolve();
        })
            .finally(function () {
            _this.templateSrv.variableInitialized(variable);
            delete variable.initLock;
        });
    };
    VariableSrv.prototype.createVariableFromModel = function (model) {
        var ctor = variableTypes[model.type].ctor;
        if (!ctor) {
            throw {
                message: 'Unable to find variable constructor for ' + model.type,
            };
        }
        var variable = this.$injector.instantiate(ctor, { model: model });
        return variable;
    };
    VariableSrv.prototype.addVariable = function (variable) {
        this.variables.push(variable);
        this.templateSrv.updateIndex();
        this.dashboard.updateSubmenuVisibility();
    };
    VariableSrv.prototype.removeVariable = function (variable) {
        var index = _.indexOf(this.variables, variable);
        this.variables.splice(index, 1);
        this.templateSrv.updateIndex();
        this.dashboard.updateSubmenuVisibility();
    };
    VariableSrv.prototype.updateOptions = function (variable) {
        return variable.updateOptions();
    };
    VariableSrv.prototype.variableUpdated = function (variable, emitChangeEvents) {
        var _this = this;
        // if there is a variable lock ignore cascading update because we are in a boot up scenario
        if (variable.initLock) {
            return this.$q.when();
        }
        var g = this.createGraph();
        var node = g.getNode(variable.name);
        var promises = [];
        if (node) {
            promises = node.getOptimizedInputEdges().map(function (e) {
                return _this.updateOptions(_this.variables.find(function (v) { return v.name === e.inputNode.name; }));
            });
        }
        return this.$q.all(promises).then(function () {
            if (emitChangeEvents) {
                _this.dashboard.templateVariableValueUpdated();
                _this.dashboard.startRefresh();
            }
        });
    };
    VariableSrv.prototype.selectOptionsForCurrentValue = function (variable) {
        var i, y, value, option;
        var selected = [];
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
            }
            else if (option.value === variable.current.value) {
                option.selected = true;
                selected.push(option);
            }
        }
        return selected;
    };
    VariableSrv.prototype.validateVariableSelectionState = function (variable) {
        if (!variable.current) {
            variable.current = {};
        }
        if (_.isArray(variable.current.value)) {
            var selected = this.selectOptionsForCurrentValue(variable);
            // if none pick first
            if (selected.length === 0) {
                selected = variable.options[0];
            }
            else {
                selected = {
                    value: _.map(selected, function (val) {
                        return val.value;
                    }),
                    text: _.map(selected, function (val) {
                        return val.text;
                    }).join(' + '),
                };
            }
            return variable.setValue(selected);
        }
        else {
            var currentOption = _.find(variable.options, {
                text: variable.current.text,
            });
            if (currentOption) {
                return variable.setValue(currentOption);
            }
            else {
                if (!variable.options.length) {
                    return Promise.resolve();
                }
                return variable.setValue(variable.options[0]);
            }
        }
    };
    VariableSrv.prototype.setOptionFromUrl = function (variable, urlValue) {
        var promise = this.$q.when();
        if (variable.refresh) {
            promise = variable.updateOptions();
        }
        return promise.then(function () {
            var option = _.find(variable.options, function (op) {
                return op.text === urlValue || op.value === urlValue;
            });
            var defaultText = urlValue;
            var defaultValue = urlValue;
            if (!option && _.isArray(urlValue)) {
                defaultText = [];
                var _loop_1 = function (n) {
                    var t = _.find(variable.options, function (op) {
                        return op.value === urlValue[n];
                    });
                    if (t) {
                        defaultText.push(t.text);
                    }
                };
                for (var n = 0; n < urlValue.length; n++) {
                    _loop_1(n);
                }
            }
            option = option || { text: defaultText, value: defaultValue };
            return variable.setValue(option);
        });
    };
    VariableSrv.prototype.setOptionAsCurrent = function (variable, option) {
        variable.current = _.cloneDeep(option);
        if (_.isArray(variable.current.text) && variable.current.text.length > 0) {
            variable.current.text = variable.current.text.join(' + ');
        }
        else if (_.isArray(variable.current.value) && variable.current.value[0] !== '$__all') {
            variable.current.text = variable.current.value.join(' + ');
        }
        this.selectOptionsForCurrentValue(variable);
        return this.variableUpdated(variable);
    };
    VariableSrv.prototype.updateUrlParamsWithCurrentVariables = function () {
        // update url
        var params = this.$location.search();
        // remove variable params
        _.each(params, function (value, key) {
            if (key.indexOf('var-') === 0) {
                delete params[key];
            }
        });
        // add new values
        this.templateSrv.fillVariableValuesForUrl(params);
        // update url
        this.$location.search(params);
    };
    VariableSrv.prototype.setAdhocFilter = function (options) {
        var variable = _.find(this.variables, {
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
        var filters = variable.filters;
        var filter = _.find(filters, { key: options.key, value: options.value });
        if (!filter) {
            filter = { key: options.key, value: options.value };
            filters.push(filter);
        }
        filter.operator = options.operator;
        this.variableUpdated(variable, true);
    };
    VariableSrv.prototype.createGraph = function () {
        var _this = this;
        var g = new Graph();
        this.variables.forEach(function (v) {
            g.createNode(v.name);
        });
        this.variables.forEach(function (v1) {
            _this.variables.forEach(function (v2) {
                if (v1 === v2) {
                    return;
                }
                if (v1.dependsOn(v2)) {
                    g.link(v1.name, v2.name);
                }
            });
        });
        return g;
    };
    return VariableSrv;
}());
export { VariableSrv };
coreModule.service('variableSrv', VariableSrv);
//# sourceMappingURL=variable_srv.js.map