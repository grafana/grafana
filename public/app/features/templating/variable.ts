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

export var variableTypes = {};
export { assignModelProperties };

export function containsVariable(...args: any[]) {
  var variableName = args[args.length - 1];
  var str = args[0] || '';

  for (var i = 1; i < args.length - 1; i++) {
    str += ' ' + args[i] || '';
  }

  variableName = kbn.regexEscape(variableName);
  var findVarRegex = new RegExp('\\$(' + variableName + ')(?:\\W|$)|\\[\\[(' + variableName + ')\\]\\]', 'g');
  var match = findVarRegex.exec(str);
  return match !== null;
}
