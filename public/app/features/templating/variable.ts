import { assignModelProperties } from 'app/core/utils/model_utils';
import { variableRegex, variableRegexExec } from 'app/core/constants';

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
