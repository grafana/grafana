
import kbn from 'app/core/utils/kbn';

export function containsVariable(str, variableName) {
  if (!str) {
    return false;
  }

  variableName = kbn.regexEscape(variableName);
  var findVarRegex = new RegExp('\\$(' + variableName + ')(?:\\W|$)|\\[\\[(' + variableName + ')\\]\\]', 'g');
  var match = findVarRegex.exec(str);
  return match !== null;
}

export interface Variable {
  setValue(option);
  updateOptions();
  dependsOn(variableName);
}




