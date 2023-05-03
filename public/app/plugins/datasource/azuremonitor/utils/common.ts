import { map } from 'lodash';

import { rangeUtil, SelectableValue } from '@grafana/data';
import { VariableWithMultiSupport } from 'app/features/variables/types';

import TimegrainConverter from '../time_grain_converter';
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

export function convertTimeGrainsToMs<T extends { value: string }>(timeGrains: T[]) {
  const allowedTimeGrainsMs: number[] = [];
  timeGrains.forEach((tg: any) => {
    if (tg.value !== 'auto') {
      allowedTimeGrainsMs.push(rangeUtil.intervalToMs(TimegrainConverter.createKbnUnitFromISO8601Duration(tg.value)));
    }
  });
  return allowedTimeGrainsMs;
}

// Route definitions shared with the backend.
// Check: /pkg/tsdb/azuremonitor/azuremonitor-resource-handler.go <registerRoutes>
export const routeNames = {
  azureMonitor: 'azuremonitor',
  logAnalytics: 'loganalytics',
  appInsights: 'appinsights',
  resourceGraph: 'resourcegraph',
};

export function interpolateVariable(value: any, variable: VariableWithMultiSupport) {
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
