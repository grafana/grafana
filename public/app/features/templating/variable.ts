import { assignModelProperties } from 'app/core/utils/model_utils';

/*
 * This regex matches 3 types of variable reference with an optional format specifier
 * \$(\w+)                          $var1
 * \[\[([\s\S]+?)(?::(\w+))?\]\]    [[var2]] or [[var2:fmt2]]
 * \${(\w+)(?::(\w+))?}             ${var3} or ${var3:fmt3}
 */
export const variableRegex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?\]\]|\${(\w+)(?::(\w+))?}/g;

// Helper function since lastIndex is not reset
export const variableRegexExec = (variableString: string) => {
  variableRegex.lastIndex = 0;
  return variableRegex.exec(variableString);
};

export interface Variable {
  setValue(option);
  updateOptions();
  dependsOn(variable);
  setValueFromUrl(urlValue);
  getValueForUrl();
  getSaveModel();
}

export let variableTypes = {};
export { assignModelProperties };

export function containsVariable(...args: any[]) {
  const variableName = args[args.length - 1];
  const variableString = args.slice(0, -1).join(' ');
  const matches = variableString.match(variableRegex);
  const isMatchingVariable =
    matches !== null
      ? matches.find(match => {
          const varMatch = variableRegexExec(match);
          return varMatch !== null && varMatch.indexOf(variableName) > -1;
        })
      : false;

  return !!isMatchingVariable;
}
