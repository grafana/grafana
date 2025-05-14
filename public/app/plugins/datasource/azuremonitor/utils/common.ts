import { map } from 'lodash';

import { ScopedVars, SelectableValue, VariableWithMultiSupport } from '@grafana/data';
import { TemplateSrv, VariableInterpolation } from '@grafana/runtime';

import { AzureMonitorOption, VariableOptionGroup } from '../types';

export const hasOption = (options: AzureMonitorOption[], value: string): boolean =>
  options.some((v) => (v.options ? hasOption(v.options, value) : v.value === value));

export const findOptions = (options: AzureMonitorOption[], values: string[] = []) => {
  if (values.length === 0) {
    return [];
  }
  const set = values.reduce((accum, item) => {
    accum.add(item);
    return accum;
  }, new Set());
  return options.filter((option) => set.has(option.value));
};

export const toOption = (v: { text: string; value: string }) => ({ value: v.value, label: v.text });

export const addValueToOptions = (
  values: Array<AzureMonitorOption | SelectableValue>,
  variableOptionGroup: VariableOptionGroup,
  value?: string
) => {
  const options = [...values, variableOptionGroup];

  const optionValues = values.map((m) => m.value.toLowerCase()).concat(variableOptionGroup.options.map((p) => p.value));
  if (value && !optionValues.includes(value.toLowerCase())) {
    options.push({ label: value, value });
  }

  return options;
};

// Route definitions shared with the backend.
// Check: /pkg/tsdb/azuremonitor/azuremonitor-resource-handler.go <registerRoutes>
export const routeNames = {
  azureMonitor: 'azuremonitor',
  logAnalytics: 'loganalytics',
  appInsights: 'appinsights',
  resourceGraph: 'resourcegraph',
};

export function interpolateVariable(
  value: string | number | Array<string | number>,
  variable: VariableWithMultiSupport
) {
  if (typeof value === 'string') {
    // When enabling multiple responses, quote the value to mimic the array result below
    // even if only one response is selected. This does not apply if only the "include all"
    // option is enabled but with a custom value.
    if (variable.multi || (variable.includeAll && !variable.allValue)) {
      return "'" + value + "'";
    } else {
      return value;
    }
  }

  if (typeof value === 'number') {
    return value;
  }

  const quotedValues = map(value, (val) => {
    if (typeof value === 'number') {
      return value;
    }

    return "'" + val + "'";
  });
  return quotedValues.join(',');
}

export function replaceTemplateVariables<T extends { [K in keyof T]: string }>(
  templateSrv: TemplateSrv,
  query: T,
  scopedVars?: ScopedVars
) {
  const workingQueries: Array<{ [K in keyof T]: string }> = [{ ...query }];
  const keys = Object.keys(query) as Array<keyof T>;
  keys.forEach((key) => {
    const rawValue = workingQueries[0][key];
    let interpolated: VariableInterpolation[] = [];
    const replaced = templateSrv.replace(rawValue, scopedVars, 'raw', interpolated);
    if (interpolated.length > 0) {
      for (const variable of interpolated) {
        if (variable.found === false) {
          continue;
        }
        if (variable.value.includes(',')) {
          const multiple = variable.value.split(',');
          const currentQueries = [...workingQueries];
          multiple.forEach((value, i) => {
            currentQueries.forEach((q) => {
              if (i === 0) {
                q[key] = rawValue.replace(variable.match, value);
              } else {
                workingQueries.push({ ...q, [key]: rawValue.replace(variable.match, value) });
              }
            });
          });
        } else {
          workingQueries.forEach((q) => {
            q[key] = replaced;
          });
        }
      }
    } else {
      workingQueries.forEach((q) => {
        q[key] = replaced;
      });
    }
  });

  return workingQueries;
}
