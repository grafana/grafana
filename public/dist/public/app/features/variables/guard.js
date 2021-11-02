import { VariableSupportType, } from '@grafana/data';
import { LEGACY_VARIABLE_QUERY_EDITOR_NAME } from './editor/LegacyVariableQueryEditor';
export var isQuery = function (model) {
    return model.type === 'query';
};
export var isAdHoc = function (model) {
    return model.type === 'adhoc';
};
export var isConstant = function (model) {
    return model.type === 'constant';
};
export var isMulti = function (model) {
    var withMulti = model;
    return withMulti.hasOwnProperty('multi') && typeof withMulti.multi === 'boolean';
};
export var hasOptions = function (model) {
    return hasObjectProperty(model, 'options');
};
export var hasCurrent = function (model) {
    return hasObjectProperty(model, 'current');
};
function hasObjectProperty(model, property) {
    if (!model) {
        return false;
    }
    var withProperty = model;
    return withProperty.hasOwnProperty(property) && typeof withProperty[property] === 'object';
}
/*
 * The following guard function are both TypeScript type guards.
 * They also make the basis for the logic used by variableQueryRunner and determining which QueryEditor to use
 * */
export var hasLegacyVariableSupport = function (datasource) {
    return Boolean(datasource.metricFindQuery) && !Boolean(datasource.variables);
};
export var hasStandardVariableSupport = function (datasource) {
    if (!datasource.variables) {
        return false;
    }
    if (datasource.variables.getType() !== VariableSupportType.Standard) {
        return false;
    }
    var variableSupport = datasource.variables;
    return Boolean(variableSupport.toDataQuery);
};
export var hasCustomVariableSupport = function (datasource) {
    if (!datasource.variables) {
        return false;
    }
    if (datasource.variables.getType() !== VariableSupportType.Custom) {
        return false;
    }
    var variableSupport = datasource.variables;
    return Boolean(variableSupport.query) && Boolean(variableSupport.editor);
};
export var hasDatasourceVariableSupport = function (datasource) {
    if (!datasource.variables) {
        return false;
    }
    return datasource.variables.getType() === VariableSupportType.Datasource;
};
export function isLegacyQueryEditor(component, datasource) {
    if (!component) {
        return false;
    }
    return component.displayName === LEGACY_VARIABLE_QUERY_EDITOR_NAME || hasLegacyVariableSupport(datasource);
}
export function isQueryEditor(component, datasource) {
    if (!component) {
        return false;
    }
    return (component.displayName !== LEGACY_VARIABLE_QUERY_EDITOR_NAME &&
        (hasDatasourceVariableSupport(datasource) ||
            hasStandardVariableSupport(datasource) ||
            hasCustomVariableSupport(datasource)));
}
//# sourceMappingURL=guard.js.map