import { escape, isString } from 'lodash';
import { deprecationWarning, } from '@grafana/data';
import { getDataSourceSrv, setTemplateSrv, } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { VariableFormatID } from '@grafana/schema';
import { variableAdapters } from '../variables/adapters';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../variables/constants';
import { isAdHoc } from '../variables/guard';
import { getFilteredVariables, getVariables, getVariableWithName } from '../variables/state/selectors';
import { variableRegex } from '../variables/utils';
import { getFieldAccessor } from './fieldAccessorCache';
import { formatVariableValue } from './formatVariableValue';
import { macroRegistry } from './macroRegistry';
const runtimeDependencies = {
    getFilteredVariables,
    getVariables,
    getVariableWithName,
};
export class TemplateSrv {
    constructor(dependencies = runtimeDependencies) {
        this.dependencies = dependencies;
        this.regex = variableRegex;
        this.index = {};
        this.grafanaVariables = new Map();
        this.timeRange = null;
        this._adhocFiltersDeprecationWarningLogged = new Map();
        this._variables = [];
    }
    init(variables, timeRange) {
        this._variables = variables;
        this.timeRange = timeRange;
        this.updateIndex();
    }
    /**
     * @deprecated: this instance variable should not be used and will be removed in future releases
     *
     * Use getVariables function instead
     */
    get variables() {
        deprecationWarning('template_srv.ts', 'variables', 'getVariables');
        return this.getVariables();
    }
    getVariables() {
        return this.dependencies.getVariables();
    }
    updateIndex() {
        const existsOrEmpty = (value) => value || value === '';
        this.index = this._variables.reduce((acc, currentValue) => {
            if (currentValue.current && (currentValue.current.isNone || existsOrEmpty(currentValue.current.value))) {
                acc[currentValue.name] = currentValue;
            }
            return acc;
        }, {});
        if (this.timeRange) {
            const from = this.timeRange.from.valueOf().toString();
            const to = this.timeRange.to.valueOf().toString();
            this.index = Object.assign(Object.assign({}, this.index), { ['__from']: {
                    current: { value: from, text: from },
                }, ['__to']: {
                    current: { value: to, text: to },
                } });
        }
    }
    updateTimeRange(timeRange) {
        this.timeRange = timeRange;
        this.updateIndex();
    }
    variableInitialized(variable) {
        this.index[variable.name] = variable;
    }
    /**
     * @deprecated
     * Use filters property on the request (DataQueryRequest) or if this is called from
     * interpolateVariablesInQueries or applyTemplateVariables it is passed as a new argument
     **/
    getAdhocFilters(datasourceName) {
        var _a;
        let filters = [];
        let ds = getDataSourceSrv().getInstanceSettings(datasourceName);
        if (!ds) {
            return [];
        }
        if (!this._adhocFiltersDeprecationWarningLogged.get(ds.type)) {
            if (process.env.NODE_ENV !== 'test') {
                deprecationWarning(`DataSource ${ds.type}`, 'templateSrv.getAdhocFilters', 'filters property on the request (DataQueryRequest). Or if this is called from interpolateVariablesInQueries or applyTemplateVariables it is passed as a new argument');
            }
            this._adhocFiltersDeprecationWarningLogged.set(ds.type, true);
        }
        for (const variable of this.getAdHocVariables()) {
            const variableUid = (_a = variable.datasource) === null || _a === void 0 ? void 0 : _a.uid;
            if (variableUid === ds.uid) {
                filters = filters.concat(variable.filters);
            }
            else if ((variableUid === null || variableUid === void 0 ? void 0 : variableUid.indexOf('$')) === 0) {
                if (this.replace(variableUid) === ds.uid) {
                    filters = filters.concat(variable.filters);
                }
            }
        }
        return filters;
    }
    setGrafanaVariable(name, value) {
        this.grafanaVariables.set(name, value);
    }
    /**
     * @deprecated: setGlobalVariable function should not be used and will be removed in future releases
     *
     * Use addVariable action to add variables to Redux instead
     */
    setGlobalVariable(name, variable) {
        deprecationWarning('template_srv.ts', 'setGlobalVariable', '');
        this.index = Object.assign(Object.assign({}, this.index), { [name]: {
                current: variable,
            } });
    }
    getVariableName(expression) {
        this.regex.lastIndex = 0;
        const match = this.regex.exec(expression);
        if (!match) {
            return null;
        }
        const variableName = match.slice(1).find((match) => match !== undefined);
        return variableName;
    }
    containsTemplate(target) {
        if (!target) {
            return false;
        }
        const name = this.getVariableName(target);
        const variable = name && this.getVariableAtIndex(name);
        return variable !== null && variable !== undefined;
    }
    variableExists(expression) {
        deprecationWarning('template_srv.ts', 'variableExists', 'containsTemplate');
        return this.containsTemplate(expression);
    }
    highlightVariablesAsHtml(str) {
        if (!str || !isString(str)) {
            return str;
        }
        str = escape(str);
        return this._replaceWithVariableRegex(str, undefined, (match, variableName) => {
            if (this.getVariableAtIndex(variableName)) {
                return '<span class="template-variable">' + match + '</span>';
            }
            return match;
        });
    }
    getAllValue(variable) {
        if (variable.allValue) {
            return variable.allValue;
        }
        const values = [];
        for (let i = 1; i < variable.options.length; i++) {
            values.push(variable.options[i].value);
        }
        return values;
    }
    getVariableValue(scopedVar, fieldPath) {
        if (fieldPath) {
            return getFieldAccessor(fieldPath)(scopedVar.value);
        }
        return scopedVar.value;
    }
    getVariableText(scopedVar, value) {
        if (scopedVar.value === value || typeof value !== 'string') {
            return scopedVar.text;
        }
        return value;
    }
    replace(target, scopedVars, format, interpolations) {
        // Scenes compatability (primary method) is via SceneObject inside scopedVars. This way we get a much more accurate "local" scope for the evaluation
        if (scopedVars && scopedVars.__sceneObject) {
            return sceneGraph.interpolate(scopedVars.__sceneObject.value, target, scopedVars, format);
        }
        // Scenes compatability: (secondary method) is using the current active scene as the scope for evaluation.
        if (window.__grafanaSceneContext && window.__grafanaSceneContext.isActive) {
            return sceneGraph.interpolate(window.__grafanaSceneContext, target, scopedVars, format);
        }
        if (!target) {
            return target !== null && target !== void 0 ? target : '';
        }
        this.regex.lastIndex = 0;
        return this._replaceWithVariableRegex(target, format, (match, variableName, fieldPath, fmt) => {
            const value = this._evaluateVariableExpression(match, variableName, fieldPath, fmt, scopedVars);
            // If we get passed this interpolations map we will also record all the expressions that were replaced
            if (interpolations) {
                interpolations.push({ match, variableName, fieldPath, format: fmt, value, found: value !== match });
            }
            return value;
        });
    }
    _evaluateVariableExpression(match, variableName, fieldPath, format, scopedVars) {
        const variable = this.getVariableAtIndex(variableName);
        const scopedVar = scopedVars === null || scopedVars === void 0 ? void 0 : scopedVars[variableName];
        if (scopedVar) {
            const value = this.getVariableValue(scopedVar, fieldPath);
            const text = this.getVariableText(scopedVar, value);
            if (value !== null && value !== undefined) {
                return formatVariableValue(value, format, variable, text);
            }
        }
        if (!variable) {
            const macro = macroRegistry[variableName];
            if (macro) {
                return macro(match, fieldPath, scopedVars, format);
            }
            return match;
        }
        if (format === VariableFormatID.QueryParam || isAdHoc(variable)) {
            const value = variableAdapters.get(variable.type).getValueForUrl(variable);
            const text = isAdHoc(variable) ? variable.id : variable.current.text;
            return formatVariableValue(value, format, variable, text);
        }
        const systemValue = this.grafanaVariables.get(variable.current.value);
        if (systemValue) {
            return formatVariableValue(systemValue, format, variable);
        }
        let value = variable.current.value;
        let text = variable.current.text;
        if (this.isAllValue(value)) {
            value = this.getAllValue(variable);
            text = ALL_VARIABLE_TEXT;
            // skip formatting of custom all values unless format set to text or percentencode
            if (variable.allValue && format !== VariableFormatID.Text && format !== VariableFormatID.PercentEncode) {
                return this.replace(value);
            }
        }
        if (fieldPath) {
            const fieldValue = this.getVariableValue({ value, text }, fieldPath);
            if (fieldValue !== null && fieldValue !== undefined) {
                return formatVariableValue(fieldValue, format, variable, text);
            }
        }
        return formatVariableValue(value, format, variable, text);
    }
    /**
     * Tries to unify the different variable format capture groups into a simpler replacer function
     */
    _replaceWithVariableRegex(text, format, replace) {
        this.regex.lastIndex = 0;
        return text.replace(this.regex, (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
            const variableName = var1 || var2 || var3;
            const fmt = fmt2 || fmt3 || format;
            return replace(match, variableName, fieldPath, fmt);
        });
    }
    isAllValue(value) {
        return value === ALL_VARIABLE_VALUE || (Array.isArray(value) && value[0] === ALL_VARIABLE_VALUE);
    }
    replaceWithText(target, scopedVars) {
        deprecationWarning('template_srv.ts', 'replaceWithText()', 'replace(), and specify the :text format');
        return this.replace(target, scopedVars, 'text');
    }
    getVariableAtIndex(name) {
        if (!name) {
            return;
        }
        if (!this.index[name]) {
            return this.dependencies.getVariableWithName(name);
        }
        return this.index[name];
    }
    getAdHocVariables() {
        return this.dependencies.getFilteredVariables(isAdHoc);
    }
}
// Expose the template srv
const srv = new TemplateSrv();
setTemplateSrv(srv);
export const getTemplateSrv = () => srv;
//# sourceMappingURL=template_srv.js.map