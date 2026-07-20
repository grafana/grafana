import { map } from 'lodash';
import { lastValueFrom } from 'rxjs';

import { AppEvents, type ScopedVars, type SelectableValue, type VariableWithMultiSupport } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  config,
  getAppEvents,
  getBackendSrv,
  logWarning,
  type TemplateSrv,
  type VariableInterpolation,
} from '@grafana/runtime';

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

export const paginatedRoutes = {
  subscriptions: 'subscriptions',
  workspaces: 'workspaces',
} as const;

// Cap the number of raw ARM pages we follow client-side (flag OFF) to avoid runaway loops.
export const MAX_ARM_PAGES = 50;

const armApiVersions = {
  subscriptions: '2019-03-01',
  workspaces: '2017-04-26-preview',
};

export interface ArmResourcePage<T> {
  value: T[];
  nextToken?: string;
  truncated: boolean;
}

function serverSidePaginationEnabled(): boolean {
  return (config.featureToggles as Record<string, boolean | undefined>).azureMonitorServerSidePagination === true;
}

// Maps a paginated subtype onto the passthrough ARM resource path (with api-version). The
// subscriptionId (workspaces only) lives in the path, not as a forwarded query param.
function armResourcePath(subtype: string, params: Record<string, string>): string {
  if (subtype === paginatedRoutes.subscriptions) {
    return `${routeNames.azureMonitor}/subscriptions?api-version=${armApiVersions.subscriptions}`;
  }
  if (subtype === paginatedRoutes.workspaces) {
    return `${routeNames.azureMonitor}/subscriptions/${params.subscriptionId}/providers/Microsoft.OperationalInsights/workspaces?api-version=${armApiVersions.workspaces}`;
  }
  return subtype;
}

const resourcesUrl = (datasourceUid: string, path: string): string =>
  `/api/datasources/uid/${datasourceUid}/resources/${path}`;

function appendParams(url: string, params: Record<string, string | undefined>): string {
  // Keys are controlled literals (listAll/nextToken/$skiptoken) so are left verbatim; only
  // values are encoded (ARM $skiptoken values can contain reserved characters).
  const query = Object.entries(params)
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  if (!query) {
    return url;
  }
  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}

export function parseNextLinkToken(linkHeader: string): string | undefined {
  const match = /<\?([^>]*)>;\s*rel="next"/.exec(linkHeader);
  if (!match) {
    return undefined;
  }
  return new URLSearchParams(match[1]).get('nextToken') ?? undefined;
}

export function skipTokenFromNextLink(nextLink?: string): string | undefined {
  if (!nextLink) {
    return undefined;
  }
  try {
    return new URL(nextLink).searchParams.get('$skiptoken') ?? undefined;
  } catch {
    return undefined;
  }
}

// Rewrites a raw ARM nextLink (absolute management.azure.com URL) onto a passthrough path by
// stripping the scheme+host, keeping path+query, and re-prefixing with the resources route.
export function nextLinkToPath(prefix: string, nextLink: string): string {
  const { pathname, search } = new URL(nextLink);
  return `${prefix}${pathname}${search}`;
}

export async function fetchArmResourcePage<T>(
  datasourceUid: string,
  subtype: string,
  params: Record<string, string> = {}
): Promise<ArmResourcePage<T>> {
  const path = armResourcePath(subtype, params);

  if (serverSidePaginationEnabled()) {
    // Flag ON: the passthrough understands listAll/nextToken and returns the cursor in the Link header.
    const url = appendParams(resourcesUrl(datasourceUid, path), {
      listAll: params.listAll,
      nextToken: params.nextToken,
    });
    const response = await lastValueFrom(getBackendSrv().fetch<AzureAPIResponse<T>>({ url, method: 'GET' }));
    const value = response.data?.value ?? [];
    const linkHeader = response.headers.get('Link');
    const nextToken = linkHeader ? parseNextLinkToken(linkHeader) : undefined;
    const truncated = response.headers.get('X-Results-Truncated') === 'true';
    return { value, nextToken, truncated };
  }

  // Flag OFF: raw ARM body. Do not forward listAll/nextToken; continuation rides ARM's own $skiptoken.
  const url = appendParams(resourcesUrl(datasourceUid, path), { $skiptoken: params.nextToken });
  const response = await lastValueFrom(getBackendSrv().fetch<AzureAPIResponse<T>>({ url, method: 'GET' }));
  const value = response.data?.value ?? [];
  const nextToken = skipTokenFromNextLink(response.data?.nextLink);
  return { value, nextToken, truncated: false };
}

export async function fetchAllArmResources<T>(
  datasourceUid: string,
  subtype: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  if (serverSidePaginationEnabled()) {
    // Flag ON: the backend eagerly pages server-side; request everything and honour the truncation header.
    const { value, truncated } = await fetchArmResourcePage<T>(datasourceUid, subtype, { ...params, listAll: 'true' });
    if (truncated) {
      warnResultsTruncated();
    }
    return value;
  }

  // Flag OFF: follow the raw ARM nextLink client-side, rewriting each onto the passthrough path.
  const prefix = resourcesUrl(datasourceUid, routeNames.azureMonitor);
  const results: T[] = [];
  let url: string | undefined = resourcesUrl(datasourceUid, armResourcePath(subtype, params));
  let pages = 0;
  for (; url && pages < MAX_ARM_PAGES; pages++) {
    const response = await lastValueFrom(getBackendSrv().fetch<AzureAPIResponse<T>>({ url, method: 'GET' }));
    results.push(...(response.data?.value ?? []));
    const nextLink = response.data?.nextLink;
    url = nextLink ? nextLinkToPath(prefix, nextLink) : undefined;
  }
  if (url) {
    warnResultsTruncated();
  }
  return results;
}

export function warnResultsTruncated(): void {
  logWarning('[azuremonitor] ARM listing truncated by the backend; some results may be omitted.');
  getAppEvents().publish({
    type: AppEvents.alertWarning.name,
    payload: [
      t('components.pagination.results-truncated-title', 'Azure Monitor'),
      t(
        'components.pagination.results-truncated-message',
        'Some results may be omitted because there were too many to load.'
      ),
    ],
  });
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
