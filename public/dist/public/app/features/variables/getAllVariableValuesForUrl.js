import { getTemplateSrv } from '@grafana/runtime';
import { variableAdapters } from './adapters';
export function getVariablesUrlParams(scopedVars) {
    var params = {};
    var variables = getTemplateSrv().getVariables();
    // console.log(variables)
    for (var i = 0; i < variables.length; i++) {
        var variable = variables[i];
        if (scopedVars && scopedVars[variable.name] !== void 0) {
            if (scopedVars[variable.name].skipUrlSync) {
                continue;
            }
            params['var-' + variable.name] = scopedVars[variable.name].value;
        }
        else {
            // @ts-ignore
            if (variable.skipUrlSync) {
                continue;
            }
            params['var-' + variable.name] = variableAdapters.get(variable.type).getValueForUrl(variable);
        }
    }
    return params;
}
//# sourceMappingURL=getAllVariableValuesForUrl.js.map