import { lastValueFrom } from 'rxjs';

import { isObject } from '@grafana/data';
import { FetchResponse, getBackendSrv } from '@grafana/runtime';
import { RulerDataSourceConfig } from 'app/types/unified-alerting';
import { RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { containsPathSeparator } from '../components/rule-editor/util';
import { RULER_NOT_SUPPORTED_MSG } from '../utils/constants';
import { GRAFANA_RULES_SOURCE_NAME, getDatasourceAPIUid } from '../utils/datasource';

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

// some gateways (like Istio) will decode "/" and "\" characters – this will cause 404 errors for any API call
// that includes these values in the URL (ie. /my/path%2fto/resource -> /my/path/to/resource)
//
// see https://istio.io/latest/docs/ops/best-practices/security/#customize-your-system-on-path-normalization
function getQueryDetailsProvider(rulerConfig: RulerDataSourceConfig): RulerQueryDetailsProvider {
  const isGrafanaDatasource = rulerConfig.dataSourceName === GRAFANA_RULES_SOURCE_NAME;

  const groupParamRewrite = (group: string): GroupUrlParams => {
    if (containsPathSeparator(group) === true) {
      return { group: QUERY_GROUP_TAG, searchParams: { group } };
    }
    return { group, searchParams: {} };
  };

  // GMA uses folderUID as namespace identifiers so we need to rewrite them
  if (isGrafanaDatasource) {
    return {
      namespace: (namespace: string) => ({ namespace, searchParams: {} }),
      group: groupParamRewrite,
    };
  }

  return {
    namespace: (namespace: string): NamespaceUrlParams => {
      if (containsPathSeparator(namespace) === true) {
        return { namespace: QUERY_NAMESPACE_TAG, searchParams: { namespace } };
      }
      return { namespace, searchParams: {} };
    },
    group: groupParamRewrite,
  };
}

function getRulerPath(rulerConfig: RulerDataSourceConfig) {
  const grafanaServerPath = `/api/ruler/${getDatasourceAPIUid(rulerConfig.dataSourceName)}`;
  return `${grafanaServerPath}/api/v1/rules`;
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
