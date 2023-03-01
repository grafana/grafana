import { VariableValue, FormatVariable } from '@grafana/scenes';
import { VariableModel, VariableType } from '@grafana/schema';

import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../variables/constants';

export class LegacyVariableWrapper implements FormatVariable {
  state: { name: string; value: VariableValue; text: VariableValue; type: VariableType };

  constructor(variable: VariableModel, value: VariableValue, text: VariableValue) {
    this.state = { name: variable.name, value, text, type: variable.type };
  }

  getValue(_fieldPath: string): VariableValue {
    let { value } = this.state;

    if (value === 'string' || value === 'number' || value === 'boolean') {
      return value;
    }

    return String(value);
  }

  getValueText(): string {
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

let legacyVariableWrapper: LegacyVariableWrapper | undefined;

/**
 * Reuses a single instance to avoid unnecessary memory allocations
 */
export function getVariableWrapper(variable: VariableModel, value: VariableValue, text: VariableValue) {
  // TODO: provide more legacy variable properties, i.e. multi, includeAll that are used in custom interpolators,
  // see Prometheus data source for example
  if (!legacyVariableWrapper) {
    legacyVariableWrapper = new LegacyVariableWrapper(variable, value, text);
  } else {
    legacyVariableWrapper.state.name = variable.name;
    legacyVariableWrapper.state.type = variable.type;
    legacyVariableWrapper.state.value = value;
    legacyVariableWrapper.state.text = text;
  }

  return legacyVariableWrapper;
}
