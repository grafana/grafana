import { __assign, __values } from "tslib";
import { escape, isString, property } from 'lodash';
import { deprecationWarning } from '@grafana/data';
import { getFilteredVariables, getVariables, getVariableWithName } from '../variables/state/selectors';
import { variableRegex } from '../variables/utils';
import { isAdHoc } from '../variables/guard';
import { getDataSourceSrv, setTemplateSrv } from '@grafana/runtime';
import { formatRegistry, FormatRegistryID } from './formatRegistry';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../variables/state/types';
import { safeStringifyValue } from '../../core/utils/explore';
var runtimeDependencies = {
    getFilteredVariables: getFilteredVariables,
    getVariables: getVariables,
    getVariableWithName: getVariableWithName,
};
var TemplateSrv = /** @class */ (function () {
    function TemplateSrv(dependencies) {
        if (dependencies === void 0) { dependencies = runtimeDependencies; }
        this.dependencies = dependencies;
        this.regex = variableRegex;
        this.index = {};
        this.grafanaVariables = {};
        this.timeRange = null;
        this.fieldAccessorCache = {};
        this._variables = [];
    }
    TemplateSrv.prototype.init = function (variables, timeRange) {
        this._variables = variables;
        this.timeRange = timeRange;
        this.updateIndex();
    };
    Object.defineProperty(TemplateSrv.prototype, "variables", {
        /**
         * @deprecated: this instance variable should not be used and will be removed in future releases
         *
         * Use getVariables function instead
         */
        get: function () {
            deprecationWarning('template_srv.ts', 'variables', 'getVariables');
            return this.getVariables();
        },
        enumerable: false,
        configurable: true
    });
    TemplateSrv.prototype.getVariables = function () {
        return this.dependencies.getVariables();
    };
    TemplateSrv.prototype.updateIndex = function () {
        var _a;
        var existsOrEmpty = function (value) { return value || value === ''; };
        this.index = this._variables.reduce(function (acc, currentValue) {
            if (currentValue.current && (currentValue.current.isNone || existsOrEmpty(currentValue.current.value))) {
                acc[currentValue.name] = currentValue;
            }
            return acc;
        }, {});
        if (this.timeRange) {
            var from = this.timeRange.from.valueOf().toString();
            var to = this.timeRange.to.valueOf().toString();
            this.index = __assign(__assign({}, this.index), (_a = {}, _a['__from'] = {
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
        var e_1, _a;
        var _b;
        var filters = [];
        var ds = getDataSourceSrv().getInstanceSettings(datasourceName);
        if (!ds) {
            return [];
        }
        try {
            for (var _c = __values(this.getAdHocVariables()), _d = _c.next(); !_d.done; _d = _c.next()) {
                var variable = _d.value;
                var variableUid = (_b = variable.datasource) === null || _b === void 0 ? void 0 : _b.uid;
                if (variableUid === ds.uid || (variable.datasource == null && (ds === null || ds === void 0 ? void 0 : ds.isDefault))) {
                    filters = filters.concat(variable.filters);
                }
                else if ((variableUid === null || variableUid === void 0 ? void 0 : variableUid.indexOf('$')) === 0) {
                    if (this.replace(variableUid) === datasourceName) {
                        filters = filters.concat(variable.filters);
                    }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return filters;
    };
    TemplateSrv.prototype.formatValue = function (value, format, variable, text) {
        // for some scopedVars there is no variable
        variable = variable || {};
        if (value === null || value === undefined) {
            return '';
        }
        if (isAdHoc(variable) && format !== FormatRegistryID.queryParam) {
            return '';
        }
        // if it's an object transform value to string
        if (!Array.isArray(value) && typeof value === 'object') {
            value = "" + value;
        }
        if (typeof format === 'function') {
            return format(value, variable, this.formatValue);
        }
        if (!format) {
            format = FormatRegistryID.glob;
        }
        // some formats have arguments that come after ':' character
        var args = format.split(':');
        if (args.length > 1) {
            format = args[0];
            args = args.slice(1);
        }
        else {
            args = [];
        }
        var formatItem = formatRegistry.getIfExists(format);
        if (!formatItem) {
            console.error("Variable format " + format + " not found. Using glob format as fallback.");
            formatItem = formatRegistry.get(FormatRegistryID.glob);
        }
        var options = { value: value, args: args, text: text !== null && text !== void 0 ? text : value };
        return formatItem.formatter(options, variable);
    };
    TemplateSrv.prototype.setGrafanaVariable = function (name, value) {
        this.grafanaVariables[name] = value;
    };
    /**
     * @deprecated: setGlobalVariable function should not be used and will be removed in future releases
     *
     * Use addVariable action to add variables to Redux instead
     */
    TemplateSrv.prototype.setGlobalVariable = function (name, variable) {
        var _a;
        deprecationWarning('template_srv.ts', 'setGlobalVariable', '');
        this.index = __assign(__assign({}, this.index), (_a = {}, _a[name] = {
            current: variable,
        }, _a));
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
        var variable = name && this.getVariableAtIndex(name);
        return variable !== null && variable !== undefined;
    };
    TemplateSrv.prototype.highlightVariablesAsHtml = function (str) {
        var _this = this;
        if (!str || !isString(str)) {
            return str;
        }
        str = escape(str);
        this.regex.lastIndex = 0;
        return str.replace(this.regex, function (match, var1, var2, fmt2, var3) {
            if (_this.getVariableAtIndex(var1 || var2 || var3)) {
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
    TemplateSrv.prototype.getFieldAccessor = function (fieldPath) {
        var accessor = this.fieldAccessorCache[fieldPath];
        if (accessor) {
            return accessor;
        }
        return (this.fieldAccessorCache[fieldPath] = property(fieldPath));
    };
    TemplateSrv.prototype.getVariableValue = function (variableName, fieldPath, scopedVars) {
        var scopedVar = scopedVars[variableName];
        if (!scopedVar) {
            return null;
        }
        if (fieldPath) {
            return this.getFieldAccessor(fieldPath)(scopedVar.value);
        }
        return scopedVar.value;
    };
    TemplateSrv.prototype.getVariableText = function (variableName, value, scopedVars) {
        var scopedVar = scopedVars[variableName];
        if (!scopedVar) {
            return null;
        }
        if (scopedVar.value === value || typeof value !== 'string') {
            return scopedVar.text;
        }
        return value;
    };
    TemplateSrv.prototype.replace = function (target, scopedVars, format) {
        var _this = this;
        if (!target) {
            return target !== null && target !== void 0 ? target : '';
        }
        this.regex.lastIndex = 0;
        return target.replace(this.regex, function (match, var1, var2, fmt2, var3, fieldPath, fmt3) {
            var _a;
            var variableName = var1 || var2 || var3;
            var variable = _this.getVariableAtIndex(variableName);
            var fmt = fmt2 || fmt3 || format;
            if (scopedVars) {
                var value_1 = _this.getVariableValue(variableName, fieldPath, scopedVars);
                var text_1 = _this.getVariableText(variableName, value_1, scopedVars);
                if (value_1 !== null && value_1 !== undefined) {
                    return _this.formatValue(value_1, fmt, variable, text_1);
                }
            }
            if (!variable) {
                return match;
            }
            if (isAdHoc(variable)) {
                var value_2 = safeStringifyValue(variable.filters);
                var text_2 = variable.id;
                return _this.formatValue(value_2, fmt, variable, text_2);
            }
            var systemValue = _this.grafanaVariables[variable.current.value];
            if (systemValue) {
                return _this.formatValue(systemValue, fmt, variable);
            }
            var value = variable.current.value;
            var text = variable.current.text;
            if (_this.isAllValue(value)) {
                value = _this.getAllValue(variable);
                text = ALL_VARIABLE_TEXT;
                // skip formatting of custom all values
                if (variable.allValue && fmt !== FormatRegistryID.text && fmt !== FormatRegistryID.queryParam) {
                    return _this.replace(value);
                }
            }
            if (fieldPath) {
                var fieldValue = _this.getVariableValue(variableName, fieldPath, (_a = {},
                    _a[variableName] = { value: value, text: text },
                    _a));
                if (fieldValue !== null && fieldValue !== undefined) {
                    return _this.formatValue(fieldValue, fmt, variable, text);
                }
            }
            var res = _this.formatValue(value, fmt, variable, text);
            return res;
        });
    };
    TemplateSrv.prototype.isAllValue = function (value) {
        return value === ALL_VARIABLE_VALUE || (Array.isArray(value) && value[0] === ALL_VARIABLE_VALUE);
    };
    TemplateSrv.prototype.replaceWithText = function (target, scopedVars) {
        deprecationWarning('template_srv.ts', 'replaceWithText()', 'replace(), and specify the :text format');
        return this.replace(target, scopedVars, 'text');
    };
    TemplateSrv.prototype.getVariableAtIndex = function (name) {
        if (!name) {
            return;
        }
        if (!this.index[name]) {
            return this.dependencies.getVariableWithName(name);
        }
        return this.index[name];
    };
    TemplateSrv.prototype.getAdHocVariables = function () {
        return this.dependencies.getFilteredVariables(isAdHoc);
    };
    return TemplateSrv;
}());
export { TemplateSrv };
// Expose the template srv
var srv = new TemplateSrv();
setTemplateSrv(srv);
export var getTemplateSrv = function () { return srv; };
//# sourceMappingURL=template_srv.js.map