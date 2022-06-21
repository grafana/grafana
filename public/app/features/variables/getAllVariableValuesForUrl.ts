import { ScopedVars, UrlQueryMap } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { variableAdapters } from './adapters';

export function getVariablesUrlParams(scopedVars?: ScopedVars): UrlQueryMap {
  const params: UrlQueryMap = {};
  const variables = getTemplateSrv().getVariables();

  for (let i = 0; i < variables.length; i++) {
    const variable = variables[i];
    if (scopedVars && scopedVars[variable.name] !== void 0) {
      if (scopedVars[variable.name].skipUrlSync) {
        continue;
      }
      params['var-' + variable.name] = scopedVars[variable.name].value;
    } else {
      // @ts-ignore
      if (variable.skipUrlSync) {
        continue;
      }
      params['var-' + variable.name] = variableAdapters.get(variable.type).getValueForUrl(variable as any);
    }
  }

  return params;
}
