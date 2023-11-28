import { VariableOption, UserProps, OrgProps, DashboardProps, ScopedVars } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';

/**
 * @remarks
 * Takes a string array of variables and non-variables and returns a string array with the raw values of the variable(s)
 * A few examples:
 * single-valued variable + non-variable item. ['$singleValuedVariable', 'log-group'] => ['value', 'log-group']
 * multi-valued variable + non-variable item. ['$multiValuedVariable', 'log-group'] => ['value1', 'value2', 'log-group']
 * @param templateSrv - The template service
 * @param strings - The array of strings to interpolate. May contain variables and non-variables.
 * @pararm scopedVars - The scoped variables to use when interpolating the variables.
 * @param key - Allows you to specify whether the variable MetricFindValue.text or MetricFindValue.value should be used when interpolating the variable. Optional, defaults to 'value'.
 **/
export const interpolateStringArrayUsingSingleOrMultiValuedVariable = (
  templateSrv: TemplateSrv,
  strings: string[],
  scopedVars: ScopedVars,
  key?: 'value' | 'text'
) => {
  key = key ?? 'value';
  const format = key === 'value' ? 'pipe' : 'text';
  let result: string[] = [];
  for (const string of strings) {
    const variableName = templateSrv.getVariableName(string);
    const valueVar = templateSrv.getVariables().find(({ name }) => name === variableName);

    if (valueVar && 'current' in valueVar && isVariableOption(valueVar.current)) {
      const rawValue = valueVar.current[key];
      if (Array.isArray(rawValue)) {
        const separator = format === 'text' ? ' + ' : '|';
        result.push(...templateSrv.replace(string, scopedVars, format).split(separator));
      } else if (typeof rawValue === 'string') {
        result.push(templateSrv.replace(string, scopedVars, format));
      }
    } else {
      // if it's not a variable, just add the raw value
      result.push(string);
    }
  }

  return result;
};

export const isTemplateVariable = (templateSrv: TemplateSrv, string: string) => {
  const variableName = templateSrv.getVariableName(string);
  return templateSrv.getVariables().some(({ name }) => name === variableName);
};

const isVariableOption = (
  current:
    | VariableOption
    | Record<string, never>
    | { value: UserProps }
    | { value: OrgProps }
    | { value: DashboardProps }
): current is VariableOption => {
  return current.hasOwnProperty('value') && current.hasOwnProperty('text');
};
