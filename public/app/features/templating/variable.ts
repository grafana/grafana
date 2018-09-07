import kbn from 'app/core/utils/kbn';
import { assignModelProperties } from 'app/core/utils/model_utils';

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
  let variableName = args[args.length - 1];
  let str = args[0] || '';

  for (let i = 1; i < args.length - 1; i++) {
    str += ' ' + args[i] || '';
  }

  variableName = kbn.regexEscape(variableName);
  const findVarRegex = new RegExp('\\$(' + variableName + ')(?:\\W|$)|\\[\\[(' + variableName + ')\\]\\]', 'g');
  const match = findVarRegex.exec(str);
  return match !== null;
}
