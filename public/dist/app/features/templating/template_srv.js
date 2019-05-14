import * as tslib_1 from "tslib";
import kbn from 'app/core/utils/kbn';
import _ from 'lodash';
import { variableRegex } from 'app/features/templating/variable';
function luceneEscape(value) {
    return value.replace(/([\!\*\+\-\=<>\s\&\|\(\)\[\]\{\}\^\~\?\:\\/"])/g, '\\$1');
}
var TemplateSrv = /** @class */ (function () {
    function TemplateSrv() {
        this.regex = variableRegex;
        this.index = {};
        this.grafanaVariables = {};
        this.builtIns = {};
        this.timeRange = null;
        this.builtIns['__interval'] = { text: '1s', value: '1s' };
        this.builtIns['__interval_ms'] = { text: '100', value: '100' };
        this.variables = [];
    }
    TemplateSrv.prototype.init = function (variables, timeRange) {
        this.variables = variables;
        this.timeRange = timeRange;
        this.updateIndex();
    };
    TemplateSrv.prototype.updateIndex = function () {
        var _a;
        var existsOrEmpty = function (value) { return value || value === ''; };
        this.index = this.variables.reduce(function (acc, currentValue) {
            if (currentValue.current && (currentValue.current.isNone || existsOrEmpty(currentValue.current.value))) {
                acc[currentValue.name] = currentValue;
            }
            return acc;
        }, {});
        if (this.timeRange) {
            var from = this.timeRange.from.valueOf().toString();
            var to = this.timeRange.to.valueOf().toString();
            this.index = tslib_1.__assign({}, this.index, (_a = {}, _a['__from'] = {
                current: { value: from, text: from },
            }, _a['__to'] = {
                current: { value: to, text: to },
            }, _a));
        }
    };
    TemplateSrv.prototype.updateTimeRange = function (timeRange) {
        this.timeRange = timeRange;
        this.updateIndex();
    };
    TemplateSrv.prototype.variableInitialized = function (variable) {
        this.index[variable.name] = variable;
    };
    TemplateSrv.prototype.getAdhocFilters = function (datasourceName) {
        var filters = [];
        if (this.variables) {
            for (var i = 0; i < this.variables.length; i++) {
                var variable = this.variables[i];
                if (variable.type !== 'adhoc') {
                    continue;
                }
                // null is the "default" datasource
                if (variable.datasource === null || variable.datasource === datasourceName) {
                    filters = filters.concat(variable.filters);
                }
                else if (variable.datasource.indexOf('$') === 0) {
                    if (this.replace(variable.datasource) === datasourceName) {
                        filters = filters.concat(variable.filters);
                    }
                }
            }
        }
        return filters;
    };
    TemplateSrv.prototype.luceneFormat = function (value) {
        if (typeof value === 'string') {
            return luceneEscape(value);
        }
        if (value instanceof Array && value.length === 0) {
            return '__empty__';
        }
        var quotedValues = _.map(value, function (val) {
            return '"' + luceneEscape(val) + '"';
        });
        return '(' + quotedValues.join(' OR ') + ')';
    };
    // encode string according to RFC 3986; in contrast to encodeURIComponent()
    // also the sub-delims "!", "'", "(", ")" and "*" are encoded;
    // unicode handling uses UTF-8 as in ECMA-262.
    TemplateSrv.prototype.encodeURIComponentStrict = function (str) {
        return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
            return ('%' +
                c
                    .charCodeAt(0)
                    .toString(16)
                    .toUpperCase());
        });
    };
    TemplateSrv.prototype.formatValue = function (value, format, variable) {
        // for some scopedVars there is no variable
        variable = variable || {};
        if (typeof format === 'function') {
            return format(value, variable, this.formatValue);
        }
        switch (format) {
            case 'regex': {
                if (typeof value === 'string') {
                    return kbn.regexEscape(value);
                }
                var escapedValues = _.map(value, kbn.regexEscape);
                if (escapedValues.length === 1) {
                    return escapedValues[0];
                }
                return '(' + escapedValues.join('|') + ')';
            }
            case 'lucene': {
                return this.luceneFormat(value);
            }
            case 'pipe': {
                if (typeof value === 'string') {
                    return value;
                }
                return value.join('|');
            }
            case 'distributed': {
                if (typeof value === 'string') {
                    return value;
                }
                return this.distributeVariable(value, variable.name);
            }
            case 'csv': {
                if (_.isArray(value)) {
                    return value.join(',');
                }
                return value;
            }
            case 'json': {
                return JSON.stringify(value);
            }
            case 'percentencode': {
                // like glob, but url escaped
                if (_.isArray(value)) {
                    return this.encodeURIComponentStrict('{' + value.join(',') + '}');
                }
                return this.encodeURIComponentStrict(value);
            }
            default: {
                if (_.isArray(value)) {
                    return '{' + value.join(',') + '}';
                }
                return value;
            }
        }
    };
    TemplateSrv.prototype.setGrafanaVariable = function (name, value) {
        this.grafanaVariables[name] = value;
    };
    TemplateSrv.prototype.getVariableName = function (expression) {
        this.regex.lastIndex = 0;
        var match = this.regex.exec(expression);
        if (!match) {
            return null;
        }
        var variableName = match.slice(1).find(function (match) { return match !== undefined; });
        return variableName;
    };
    TemplateSrv.prototype.variableExists = function (expression) {
        var name = this.getVariableName(expression);
        return name && this.index[name] !== void 0;
    };
    TemplateSrv.prototype.highlightVariablesAsHtml = function (str) {
        var _this = this;
        if (!str || !_.isString(str)) {
            return str;
        }
        str = _.escape(str);
        this.regex.lastIndex = 0;
        return str.replace(this.regex, function (match, var1, var2, fmt2, var3) {
            if (_this.index[var1 || var2 || var3] || _this.builtIns[var1 || var2 || var3]) {
                return '<span class="template-variable">' + match + '</span>';
            }
            return match;
        });
    };
    TemplateSrv.prototype.getAllValue = function (variable) {
        if (variable.allValue) {
            return variable.allValue;
        }
        var values = [];
        for (var i = 1; i < variable.options.length; i++) {
            values.push(variable.options[i].value);
        }
        return values;
    };
    TemplateSrv.prototype.replace = function (target, scopedVars, format) {
        var _this = this;
        if (!target) {
            return target;
        }
        var variable, systemValue, value, fmt;
        this.regex.lastIndex = 0;
        return target.replace(this.regex, function (match, var1, var2, fmt2, var3, fmt3) {
            variable = _this.index[var1 || var2 || var3];
            fmt = fmt2 || fmt3 || format;
            if (scopedVars) {
                value = scopedVars[var1 || var2 || var3];
                if (value) {
                    return _this.formatValue(value.value, fmt, variable);
                }
            }
            if (!variable) {
                return match;
            }
            systemValue = _this.grafanaVariables[variable.current.value];
            if (systemValue) {
                return _this.formatValue(systemValue, fmt, variable);
            }
            value = variable.current.value;
            if (_this.isAllValue(value)) {
                value = _this.getAllValue(variable);
                // skip formatting of custom all values
                if (variable.allValue) {
                    return _this.replace(value);
                }
            }
            var res = _this.formatValue(value, fmt, variable);
            return res;
        });
    };
    TemplateSrv.prototype.isAllValue = function (value) {
        return value === '$__all' || (Array.isArray(value) && value[0] === '$__all');
    };
    TemplateSrv.prototype.replaceWithText = function (target, scopedVars) {
        var _this = this;
        if (!target) {
            return target;
        }
        var variable;
        this.regex.lastIndex = 0;
        return target.replace(this.regex, function (match, var1, var2, fmt2, var3) {
            if (scopedVars) {
                var option = scopedVars[var1 || var2 || var3];
                if (option) {
                    return option.text;
                }
            }
            variable = _this.index[var1 || var2 || var3];
            if (!variable) {
                return match;
            }
            var value = _this.grafanaVariables[variable.current.value];
            return typeof value === 'string' ? value : variable.current.text;
        });
    };
    TemplateSrv.prototype.fillVariableValuesForUrl = function (params, scopedVars) {
        _.each(this.variables, function (variable) {
            if (scopedVars && scopedVars[variable.name] !== void 0) {
                if (scopedVars[variable.name].skipUrlSync) {
                    return;
                }
                params['var-' + variable.name] = scopedVars[variable.name].value;
            }
            else {
                if (variable.skipUrlSync) {
                    return;
                }
                params['var-' + variable.name] = variable.getValueForUrl();
            }
        });
    };
    TemplateSrv.prototype.distributeVariable = function (value, variable) {
        value = _.map(value, function (val, index) {
            if (index !== 0) {
                return variable + '=' + val;
            }
            else {
                return val;
            }
        });
        return value.join(',');
    };
    return TemplateSrv;
}());
export { TemplateSrv };
export default new TemplateSrv();
//# sourceMappingURL=template_srv.js.map