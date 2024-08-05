import { lastValueFrom } from 'rxjs';

import { isObject } from '@grafana/data';
import { FetchResponse, getBackendSrv } from '@grafana/runtime';
import { RulerDataSourceConfig } from 'app/types/unified-alerting';
import { PostableRulerRuleGroupDTO, RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { RULER_NOT_SUPPORTED_MSG } from '../utils/constants';
import { getDatasourceAPIUid, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { getRulesFilterSearchParams } from './prometheus';

interface ErrorResponseMessage {
  message?: string;
  error?: string;
}

export interface RulerRequestUrl {
  path: string;
  params?: Record<string, string>;
}

const QUERY_NAMESPACE_TAG = 'QUERY_NAMESPACE';
const QUERY_GROUP_TAG = 'QUERY_GROUP';

export function rulerUrlBuilder(rulerConfig: RulerDataSourceConfig) {
  const rulerPath = getRulerPath(rulerConfig);
  const queryDetailsProvider = getQueryDetailsProvider(rulerConfig);

  const subtype = rulerConfig.apiVersion === 'legacy' ? 'cortex' : 'mimir';

  return {
    rules: (filter?: FetchRulerRulesFilter): RulerRequestUrl => ({
      path: rulerPath,
      params: { subtype, ...getRulesFilterSearchParams(filter) },
    }),

    namespace: (namespace: string): RulerRequestUrl => {
      // To handle slashes we need to convert namespace to a query parameter
      const { namespace: finalNs, searchParams: nsParams } = queryDetailsProvider.namespace(namespace);

      return {
        path: `${rulerPath}/${encodeURIComponent(finalNs)}`,
        params: { subtype, ...nsParams },
      };
    },

    namespaceGroup: (namespaceUID: string, group: string): RulerRequestUrl => {
      const { namespace: finalNs, searchParams: nsParams } = queryDetailsProvider.namespace(namespaceUID);
      const { group: finalGroup, searchParams: groupParams } = queryDetailsProvider.group(group);

      return {
        path: `${rulerPath}/${encodeURIComponent(finalNs)}/${encodeURIComponent(finalGroup)}`,
        params: { subtype, ...nsParams, ...groupParams },
      };
    },
  };
}

interface NamespaceUrlParams {
  namespace: string;
  searchParams: Record<string, string>;
}

interface GroupUrlParams {
  group: string;
  searchParams: Record<string, string>;
}

interface RulerQueryDetailsProvider {
  namespace: (namespace: string) => NamespaceUrlParams;
  group: (group: string) => GroupUrlParams;
}

function getQueryDetailsProvider(rulerConfig: RulerDataSourceConfig): RulerQueryDetailsProvider {
  const isGrafanaDatasource = rulerConfig.dataSourceName === GRAFANA_RULES_SOURCE_NAME;

  const externalRulerSearchParams = {
    subtype: rulerConfig.apiVersion === 'legacy' ? 'cortex' : 'mimir',
  };

  // For Grafana we only proxy namespace and group parameters. No need to deal with slashes
  if (isGrafanaDatasource) {
    return {
      namespace: (namespace: string) => ({ namespace, searchParams: {} }),
      group: (group: string) => ({ group, searchParams: {} }),
    };
  }

  return {
    namespace: (namespace: string) => {
      const containsSlash = namespace.includes('/');
      if (containsSlash) {
        return { namespace: QUERY_NAMESPACE_TAG, searchParams: { ...externalRulerSearchParams, namespace } };
      }
      return { namespace, searchParams: externalRulerSearchParams };
    },
    group: (group: string) => {
      const containsSlash = group.includes('/');
      if (containsSlash) {
        return { group: QUERY_GROUP_TAG, searchParams: { ...externalRulerSearchParams, group } };
      }
      return { group, searchParams: externalRulerSearchParams };
    },
  };
}

function getRulerPath(rulerConfig: RulerDataSourceConfig) {
  const grafanaServerPath = `/api/ruler/${getDatasourceAPIUid(rulerConfig.dataSourceName)}`;
  return `${grafanaServerPath}/api/v1/rules`;
}

// upsert a rule group. use this to update rule
export async function setRulerRuleGroup(
  rulerConfig: RulerDataSourceConfig,
  namespaceIdentifier: string,
  group: PostableRulerRuleGroupDTO
): Promise<void> {
  const { path, params } = rulerUrlBuilder(rulerConfig).namespace(namespaceIdentifier);
  await lastValueFrom(
    getBackendSrv().fetch<unknown>({
      method: 'POST',
      url: path,
      data: group,
      showErrorAlert: false,
      showSuccessAlert: false,
      params,
    })
  );
}

export interface FetchRulerRulesFilter {
  dashboardUID?: string;
  panelId?: number;
}

// fetch all ruler rule namespaces and included groups
export async function fetchRulerRules(rulerConfig: RulerDataSourceConfig, filter?: FetchRulerRulesFilter) {
  if (filter?.dashboardUID && rulerConfig.dataSourceName !== GRAFANA_RULES_SOURCE_NAME) {
    throw new Error('Filtering by dashboard UID is only supported by Grafana.');
  }

  // TODO Move params creation to the rules function
  const { path: url, params } = rulerUrlBuilder(rulerConfig).rules(filter);
  return rulerGetRequest<RulerRulesConfigDTO>(url, {}, params);
}

// fetch rule groups for a particular namespace
// will throw with { status: 404 } if namespace does not exist
export async function fetchRulerRulesNamespace(rulerConfig: RulerDataSourceConfig, namespace: string) {
  const { path, params } = rulerUrlBuilder(rulerConfig).namespace(namespace);
  const result = await rulerGetRequest<Record<string, RulerRuleGroupDTO[]>>(path, {}, params);
  return result[namespace] || [];
}

// fetch a particular rule group
// will throw with { status: 404 } if rule group does not exist
export async function fetchTestRulerRulesGroup(dataSourceName: string): Promise<RulerRuleGroupDTO | null> {
  return rulerGetRequest<RulerRuleGroupDTO | null>(
    `/api/ruler/${getDatasourceAPIUid(dataSourceName)}/api/v1/rules/test/test`,
    null
  );
}

export async function fetchRulerRulesGroup(
  rulerConfig: RulerDataSourceConfig,
  namespaceIdentifier: string, // can be the namespace name or namespace UID
  group: string
): Promise<RulerRuleGroupDTO | null> {
  const { path, params } = rulerUrlBuilder(rulerConfig).namespaceGroup(namespaceIdentifier, group);
  return rulerGetRequest<RulerRuleGroupDTO | null>(path, null, params);
}

export async function deleteRulerRulesGroup(rulerConfig: RulerDataSourceConfig, namespace: string, groupName: string) {
  const { path, params } = rulerUrlBuilder(rulerConfig).namespaceGroup(namespace, groupName);
  await lastValueFrom(
    getBackendSrv().fetch({
      url: path,
      method: 'DELETE',
      showSuccessAlert: false,
      showErrorAlert: false,
      params,
    })
  );
}

// false in case ruler is not supported. this is weird, but we'll work on it
async function rulerGetRequest<T>(url: string, empty: T, params?: Record<string, string>): Promise<T> {
  try {
    const response = await lastValueFrom(
      getBackendSrv().fetch<T>({
        url,
        showErrorAlert: false,
        showSuccessAlert: false,
        params,
      })
    );
    return response.data;
  } catch (error) {
    if (!isResponseError(error)) {
      throw error;
    }

    if (isCortexErrorResponse(error)) {
      return empty;
    } else if (isRulerNotSupported(error)) {
      // assert if the endoint is not supported at all
      throw {
        ...error,
        data: {
          ...error.data,
          message: RULER_NOT_SUPPORTED_MSG,
        },
      };
    }
    throw error;
  }
}

function isResponseError(error: unknown): error is FetchResponse<ErrorResponseMessage> {
  if (!isObject(error)) {
    return false;
  }

  const hasErrorMessage = 'data' in error && error.data !== null && error.data !== undefined;
  const hasErrorCode = 'status' in error && Number.isFinite(error.status);

  return hasErrorCode && hasErrorMessage;
}

function isRulerNotSupported(error: FetchResponse<ErrorResponseMessage>) {
  return (
    error.status === 404 ||
    (error.status === 500 &&
      error.data.message?.includes('unexpected content type from upstream. expected YAML, got text/html'))
  );
}

function isCortexErrorResponse(error: FetchResponse<ErrorResponseMessage>) {
  return (
    error.status === 404 &&
    (error.data.message?.includes('group does not exist') || error.data.message?.includes('no rule groups found'))
  );
}

export async function deleteNamespace(rulerConfig: RulerDataSourceConfig, namespace: string): Promise<void> {
  const { path, params } = rulerUrlBuilder(rulerConfig).namespace(namespace);
  await lastValueFrom(
    getBackendSrv().fetch<unknown>({
      method: 'DELETE',
      url: path,
      showErrorAlert: false,
      showSuccessAlert: false,
      params,
    })
  );
}
