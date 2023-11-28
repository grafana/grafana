import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../variables/constants';
export class LegacyVariableWrapper {
    constructor(variable, value, text) {
        this.state = { name: variable.name, value, text, type: variable.type };
    }
    getValue(_fieldPath) {
        let { value } = this.state;
        if (value === 'string' || value === 'number' || value === 'boolean') {
            return value;
        }
        return String(value);
    }
    getValueText() {
        const { value, text } = this.state;
        if (typeof text === 'string') {
            return value === ALL_VARIABLE_VALUE ? ALL_VARIABLE_TEXT : text;
        }
        if (Array.isArray(text)) {
            return text.join(' + ');
        }
        console.log('value', text);
        return String(text);
    }
}
let legacyVariableWrapper;
/**
 * Reuses a single instance to avoid unnecessary memory allocations
 */
export function getVariableWrapper(variable, value, text) {
    // TODO: provide more legacy variable properties, i.e. multi, includeAll that are used in custom interpolators,
    // see Prometheus data source for example
    if (!legacyVariableWrapper) {
        legacyVariableWrapper = new LegacyVariableWrapper(variable, value, text);
    }
    else {
        legacyVariableWrapper.state.name = variable.name;
        legacyVariableWrapper.state.type = variable.type;
        legacyVariableWrapper.state.value = value;
        legacyVariableWrapper.state.text = text;
    }
    return legacyVariableWrapper;
}
//# sourceMappingURL=LegacyVariableWrapper.js.map