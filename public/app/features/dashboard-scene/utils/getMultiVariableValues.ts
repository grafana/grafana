import type { CustomVariable, MultiValueVariable } from '@grafana/scenes';

export function getMultiVariableValues(variable: MultiValueVariable | CustomVariable) {
  const { value, text, options } = variable.state;

  if (variable.hasAllValue()) {
    return {
      values: options.map((o) => o.value),
      texts: options.map((o) => o.label),
    };
  }

  return {
    values: Array.isArray(value) ? value : [value],
    texts: Array.isArray(text) ? text : [text],
  };
}
