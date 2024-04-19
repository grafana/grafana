import { forOwn } from 'lodash';

import { VARIABLE_FORMATS, VariableFormat, VariableReplacement, Variables } from '@grafana/data';

export function detectVariables(obj: object, currentPath?: string[]): Variables {
  currentPath = currentPath || ['$'];
  let variables: Variables = {};
  forOwn(obj, (value: unknown, key) => {
    if (typeof value === 'string') {
      let regex = /\$(\w+)|\[\[(\w+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;
      let result = regex.exec(value);
      while (result) {
        let full = result[0];
        let variableName = result[1] || result[4] || '';
        let format = result[6] || '';
        let start = result.index;
        let end = result.index + full.length;
        if (variableName && currentPath) {
          const variable: VariableReplacement = {
            path: currentPath.concat(key).join('.'),
            position: {
              start,
              end,
            },
            format: VARIABLE_FORMATS.includes(format) ? (format as VariableFormat) : 'raw',
          };
          variables[variableName] = variables[variableName] || [];
          variables[variableName].push(variable);
        }
        result = regex.exec(value);
      }
    } else if (typeof value === 'object' && value && currentPath) {
      const newVariables = detectVariables(value, [...currentPath, key]);
      Object.keys(newVariables).forEach((variableName) => {
        variables[variableName] = variables[variableName] || [];
        variables[variableName] = variables[variableName].concat(newVariables[variableName]);
      });
    }
  });
  return variables;
}
