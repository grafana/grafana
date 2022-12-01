import { FormatVariable } from '../scenes/variables/interpolation/formatRegistry';
import { VariableValue } from '../scenes/variables/types';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../variables/constants';

export class LegacyVariableWrapper implements FormatVariable {
  state: { name: string; value: VariableValue; text: VariableValue };

  constructor(name: string, value: VariableValue, text: VariableValue) {
    this.state = { name, value, text };
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
export function getVariableWrapper(name: string, value: VariableValue, text: VariableValue) {
  if (!legacyVariableWrapper) {
    legacyVariableWrapper = new LegacyVariableWrapper(name, value, text);
  } else {
    legacyVariableWrapper.state.name = name;
    legacyVariableWrapper.state.value = value;
    legacyVariableWrapper.state.text = text;
  }

  return legacyVariableWrapper;
}
