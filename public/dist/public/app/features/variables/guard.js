import { VariableSupportType, } from '@grafana/data';
import { LEGACY_VARIABLE_QUERY_EDITOR_NAME } from './editor/LegacyVariableQueryEditor';
/** @deprecated use a if (model.type === "query") type narrowing check instead */
export const isQuery = (model) => {
    return model.type === 'query';
};
/** @deprecated use a if (model.type === "adhoc") type narrowing check instead */
export const isAdHoc = (model) => {
    return model.type === 'adhoc';
};
/** @deprecated use a if (model.type === "constant") type narrowing check instead */
export const isConstant = (model) => {
    return model.type === 'constant';
};
export const isMulti = (model) => {
    return 'multi' in model;
};
export const hasOptions = (model) => {
    return 'options' in model;
};
export const hasCurrent = (model) => {
    return 'current' in model;
};
export function isLegacyAdHocDataSource(datasource) {
    if (datasource === null) {
        return false;
    }
    return typeof datasource === 'string';
}
/*
 * The following guard function are both TypeScript type guards.
 * They also make the basis for the logic used by variableQueryRunner and determining which QueryEditor to use
 * */
export const hasLegacyVariableSupport = (datasource) => {
    return Boolean(datasource.metricFindQuery) && !Boolean(datasource.variables);
};
export const hasStandardVariableSupport = (datasource) => {
    if (!datasource.variables) {
        return false;
    }
    if (datasource.variables.getType() !== VariableSupportType.Standard) {
        return false;
    }
    const variableSupport = datasource.variables;
    return 'toDataQuery' in variableSupport && Boolean(variableSupport.toDataQuery);
};
export const hasCustomVariableSupport = (datasource) => {
    if (!datasource.variables) {
        return false;
    }
    if (datasource.variables.getType() !== VariableSupportType.Custom) {
        return false;
    }
    const variableSupport = datasource.variables;
    return ('query' in variableSupport &&
        'editor' in variableSupport &&
        Boolean(variableSupport.query) &&
        Boolean(variableSupport.editor));
};
export const hasDatasourceVariableSupport = (datasource) => {
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