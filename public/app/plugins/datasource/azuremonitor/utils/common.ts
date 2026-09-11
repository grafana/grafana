import { map } from 'lodash';

import { AppEvents, type ScopedVars, type SelectableValue, type VariableWithMultiSupport } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents, logWarning, type TemplateSrv, type VariableInterpolation } from '@grafana/runtime';

import { type AzureAPIResponse, type AzureMonitorOption, type VariableOptionGroup } from '../types/types';

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

export const MAX_ARM_PAGES = 50;

export function nextLinkToPath(prefix: string, nextLink: string): string {
  const { pathname, search } = new URL(nextLink);
  return `${prefix}${pathname}${search}`;
}

export async function fetchAllArmPages<T>(
  prefix: string,
  initialPath: string,
  fetchPage: (path: string) => Promise<AzureAPIResponse<T> | undefined>,
  maxPages: number = MAX_ARM_PAGES
): Promise<T[]> {
  const results: T[] = [];
  let path: string | undefined = initialPath;
  let pages = 0;
  for (; path && pages < maxPages; pages++) {
    const page = await fetchPage(path);
    if (!page) {
      logWarning('[azuremonitor] ARM page request returned no result; stopping pagination.');
      path = undefined;
      break;
    }
    results.push(...(page.value ?? []));
    path = page.nextLink ? nextLinkToPath(prefix, page.nextLink) : undefined;
  }
  if (path) {
    logWarning(`[azuremonitor] ARM listing stopped after ${maxPages} pages; some results may be omitted.`);
    getAppEvents().publish({
      type: AppEvents.alertWarning.name,
      payload: [
        t('components.pagination.results-truncated-title', 'Azure Monitor'),
        t(
          'components.pagination.results-truncated-message',
          'Stopped loading after {{maxPages}} pages; some results may be omitted.',
          { maxPages }
        ),
      ],
    });
  }
  return results;
}

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
