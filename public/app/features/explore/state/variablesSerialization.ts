import { ExploreUrlVariable } from '@grafana/data';
import { CustomVariable, SceneVariable, SceneVariableSet } from '@grafana/scenes';

export function serializeVariableSet(variableSet: SceneVariableSet): ExploreUrlVariable[] | undefined {
  const variables = variableSet.state.variables;
  if (variables.length === 0) {
    return undefined;
  }

  return variables.map((v) => {
    if (v instanceof CustomVariable) {
      const s = v.state;
      const serialized: ExploreUrlVariable = {
        name: s.name,
        query: s.query,
      };
      if (s.label) {
        serialized.label = s.label;
      }
      if (s.description) {
        serialized.description = s.description;
      }
      if (s.isMulti) {
        serialized.isMulti = s.isMulti;
      }
      if (s.includeAll) {
        serialized.includeAll = s.includeAll;
      }
      if (s.allValue) {
        serialized.allValue = s.allValue;
      }
      if (s.allowCustomValue) {
        serialized.allowCustomValue = s.allowCustomValue;
      }
      const value = s.value;
      const text = s.text;
      if (value !== undefined && value !== '') {
        serialized.value = Array.isArray(value) ? value.map(String) : String(value);
      }
      if (text !== undefined && text !== '') {
        serialized.text = Array.isArray(text) ? text.map(String) : String(text);
      }
      return serialized;
    }

    return {
      name: v.state.name,
      query: '',
    };
  });
}

export function deserializeVariables(urlVars: ExploreUrlVariable[]): SceneVariable[] {
  return urlVars
    .filter((v) => v.name && typeof v.name === 'string')
    .map((v) => {
      const variable = new CustomVariable({
        name: v.name,
        label: v.label,
        description: v.description ?? undefined,
        query: v.query || '',
        isMulti: v.isMulti,
        includeAll: v.includeAll,
        allValue: v.allValue,
        allowCustomValue: v.allowCustomValue,
        value: v.value ?? '',
        text: v.text ?? '',
      });
      const options = variable.transformCsvStringToOptions(v.query || '', false);
      variable.setState({ options });
      return variable;
    });
}
