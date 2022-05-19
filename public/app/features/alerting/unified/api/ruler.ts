import { lastValueFrom } from 'rxjs';

import { FetchResponse, getBackendSrv } from '@grafana/runtime';
import { RulerDataSourceConfig } from 'app/types/unified-alerting';
import { PostableRulerRuleGroupDTO, RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { RULER_NOT_SUPPORTED_MSG } from '../utils/constants';
import { getDatasourceAPIUid, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { prepareRulesFilterQueryParams } from './prometheus';

interface ErrorResponseMessage {
  message?: string;
  error?: string;
}

export interface RulerRequestUrl {
  path: string;
  params?: Record<string, string>;
}

export function rulerUrlBuilder(rulerConfig: RulerDataSourceConfig) {
  const grafanaServerPath = `/api/ruler/${getDatasourceAPIUid(rulerConfig.dataSourceName)}`;

  const rulerPath = `${grafanaServerPath}/api/v1/rules`;
  const rulerSearchParams = new URLSearchParams();

  rulerSearchParams.set('subtype', rulerConfig.apiVersion === 'legacy' ? 'cortex' : 'mimir');

  return {
    rules: (filter?: FetchRulerRulesFilter): RulerRequestUrl => {
      const params = prepareRulesFilterQueryParams(rulerSearchParams, filter);

      return {
        path: `${rulerPath}`,
        params: params,
      };
    },
    namespace: (namespace: string): RulerRequestUrl => ({
      path: `${rulerPath}/${encodeURIComponent(namespace)}`,
      params: Object.fromEntries(rulerSearchParams),
    }),
    namespaceGroup: (namespace: string, group: string): RulerRequestUrl => ({
      path: `${rulerPath}/${encodeURIComponent(namespace)}/${encodeURIComponent(group)}`,
      params: Object.fromEntries(rulerSearchParams),
    }),
  };
}

// upsert a rule group. use this to update rule
export async function setRulerRuleGroup(
  rulerConfig: RulerDataSourceConfig,
  namespace: string,
  group: PostableRulerRuleGroupDTO
): Promise<void> {
  const { path, params } = rulerUrlBuilder(rulerConfig).namespace(namespace);
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
  dashboardUID: string;
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
  namespace: string,
  group: string
): Promise<RulerRuleGroupDTO | null> {
  const { path, params } = rulerUrlBuilder(rulerConfig).namespaceGroup(namespace, group);
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
  const hasErrorMessage = (error as FetchResponse<ErrorResponseMessage>).data != null;
  const hasErrorCode = Number.isFinite((error as FetchResponse<ErrorResponseMessage>).status);
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
