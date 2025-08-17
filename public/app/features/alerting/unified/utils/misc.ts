import { isString, sortBy } from 'lodash';

import { Labels, UrlQueryMap } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { config, isFetchError } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';
import { getMessageFromError, getRequestConfigFromError, getStatusFromError } from 'app/core/utils/errors';
import { escapePathSeparators } from 'app/features/alerting/unified/utils/rule-id';
import {
  alertInstanceKey,
  isCloudRuleIdentifier,
  isGrafanaRuleIdentifier,
  isPrometheusRuleIdentifier,
} from 'app/features/alerting/unified/utils/rules';
import { SortOrder } from 'app/plugins/panel/alertlist/types';
import {
  Alert,
  CombinedRule,
  DataSourceRuleGroupIdentifier,
  FilterState,
  RuleIdentifier,
  RuleWithLocation,
  RulesSource,
  SilenceFilterState,
} from 'app/types/unified-alerting';
import {
  GrafanaAlertState,
  PromAlertingRuleState,
  PromRuleDTO,
  mapStateWithReasonToBaseState,
} from 'app/types/unified-alerting-dto';

import { ALERTMANAGER_NAME_QUERY_KEY } from './constants';
import { getRulesSourceName } from './datasource';
import {
  KnownErrorCodes,
  getErrorMessageFromApiMachineryErrorResponse,
  getErrorMessageFromCode,
  isApiMachineryError,
} from './k8s/errors';
import { getMatcherQueryParams } from './matchers';
import { rulesNav } from './navigation';
import * as ruleId from './rule-id';
import { createAbsoluteUrl, createRelativeUrl } from './url';

export function createViewLink(ruleSource: RulesSource, rule: CombinedRule, returnTo?: string): string {
  const sourceName = getRulesSourceName(ruleSource);
  const identifier = ruleId.fromCombinedRule(sourceName, rule);

  return rulesNav.detailsPageLink(sourceName, identifier, returnTo ? { returnTo } : undefined);
}

export function createViewLinkV2(
  groupIdentifier: DataSourceRuleGroupIdentifier,
  rule: PromRuleDTO,
  returnTo?: string
): string {
  const ruleSourceName = groupIdentifier.rulesSource.name;
  const identifier = ruleId.fromRule(ruleSourceName, groupIdentifier.namespace.name, groupIdentifier.groupName, rule);

  return rulesNav.detailsPageLink(ruleSourceName, identifier, returnTo ? { returnTo } : undefined);
}

export function createViewLinkFromRuleWithLocation(ruleWithLocation: RuleWithLocation) {
  const ruleSourceName = ruleWithLocation.ruleSourceName;
  const identifier = ruleId.fromRuleWithLocation(ruleWithLocation);
  const paramId = encodeURIComponent(ruleId.stringifyIdentifier(identifier));
  const paramSource = encodeURIComponent(ruleSourceName);

  return createRelativeUrl(`/alerting/${paramSource}/${paramId}/view`);
}

export function createExploreLink(datasource: DataSourceRef, query: string) {
  const { uid, type } = datasource;

  return createRelativeUrl(`/explore`, {
    left: JSON.stringify({
      datasource: datasource.uid,
      queries: [{ refId: 'A', datasource: { uid, type }, expr: query }],
      range: { from: 'now-1h', to: 'now' },
    }),
  });
}

export function createContactPointLink(contactPoint: string, alertManagerSourceName = ''): string {
  return createRelativeUrl(`/alerting/notifications/receivers/${encodeURIComponent(contactPoint)}/edit`, {
    alertmanager: alertManagerSourceName,
  });
}

/**
 * @deprecated Avoid using this - we should instead endeavour to use IDs to link directly to contact points.
 * This isn't always possible, so only use this if we only have access to a contact point's name
 */
export function createContactPointSearchLink(contactPoint: string, alertManagerSourceName = ''): string {
  return createRelativeUrl(`/alerting/notifications`, {
    search: contactPoint,
    tab: 'contact_points',
    alertmanager: alertManagerSourceName,
  });
}

export function createMuteTimingLink(muteTimingName: string, alertManagerSourceName = ''): string {
  return createRelativeUrl('/alerting/routes/mute-timing/edit', {
    muteName: muteTimingName,
    alertmanager: alertManagerSourceName,
  });
}

export function createShareLink(ruleIdentifier: RuleIdentifier): string | undefined {
  if (isCloudRuleIdentifier(ruleIdentifier) || isPrometheusRuleIdentifier(ruleIdentifier)) {
    return createAbsoluteUrl(
      `/alerting/${encodeURIComponent(ruleIdentifier.ruleSourceName)}/${encodeURIComponent(escapePathSeparators(ruleIdentifier.ruleName))}/find`
    );
  } else if (isGrafanaRuleIdentifier(ruleIdentifier)) {
    return createAbsoluteUrl(`/alerting/grafana/${ruleIdentifier.uid}/view`);
  }

  return;
}

export function arrayToRecord(items: Array<{ key: string; value: string }>): Record<string, string> {
  return items.reduce<Record<string, string>>((rec, { key, value }) => {
    rec[key] = value;
    return rec;
  }, {});
}

export const getFiltersFromUrlParams = (queryParams: UrlQueryMap): FilterState => {
  const queryString = queryParams.queryString === undefined ? undefined : String(queryParams.queryString);
  const alertState = queryParams.alertState === undefined ? undefined : String(queryParams.alertState);
  const dataSource = queryParams.dataSource === undefined ? undefined : String(queryParams.dataSource);
  const ruleType = queryParams.ruleType === undefined ? undefined : String(queryParams.ruleType);
  const groupBy = queryParams.groupBy === undefined ? undefined : String(queryParams.groupBy).split(',');
  const receiver = queryParams.receiver === undefined ? undefined : String(queryParams.receiver).split(',');
  return { queryString, alertState, dataSource, groupBy, ruleType, receiver };
};

export const getNotificationPoliciesFilters = (searchParams: URLSearchParams) => {
  return {
    queryString: searchParams.get('queryString') ?? undefined,
    contactPoint: searchParams.get('contactPoint') ?? undefined,
  };
};

export const getSilenceFiltersFromUrlParams = (queryParams: UrlQueryMap): SilenceFilterState => {
  const queryString = queryParams.queryString === undefined ? undefined : String(queryParams.queryString);
  const silenceState = queryParams.silenceState === undefined ? undefined : String(queryParams.silenceState);

  return { queryString, silenceState };
};

export function recordToArray(record: Record<string, string>): Array<{ key: string; value: string }> {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

type URLParamsLike = ConstructorParameters<typeof URLSearchParams>[0];
export function makeAMLink(path: string, alertManagerName?: string, options?: URLParamsLike): string {
  const search = new URLSearchParams(options);

  if (alertManagerName) {
    search.set(ALERTMANAGER_NAME_QUERY_KEY, alertManagerName);
  }
  return `${path}?${search.toString()}`;
}

export function makeLabelBasedSilenceLink(alertManagerSourceName: string, labels: Labels) {
  const silenceUrlParams = new URLSearchParams();
  silenceUrlParams.append('alertmanager', alertManagerSourceName);

  const matcherParams = getMatcherQueryParams(labels);
  matcherParams.forEach((value, key) => silenceUrlParams.append(key, value));

  return createRelativeUrl('/alerting/silence/new', silenceUrlParams);
}

export function makeDataSourceLink(uid: string) {
  return createRelativeUrl(`/datasources/edit/${uid}`);
}

export function makeFolderLink(folderUID: string): string {
  return createRelativeUrl(`/dashboards/f/${folderUID}`);
}

export function makeFolderAlertsLink(folderUID: string, title: string): string {
  return createRelativeUrl(`/dashboards/f/${folderUID}/${title}/alerting`);
}

export function makeFolderSettingsLink(uid: string): string {
  return createRelativeUrl(`/dashboards/f/${uid}/settings`);
}

export function makeDashboardLink(dashboardUID: string): string {
  return createRelativeUrl(`/d/${encodeURIComponent(dashboardUID)}`);
}

export function makePanelLink(dashboardUID: string, panelId: string): string {
  const panelParams = new URLSearchParams({ viewPanel: panelId });
  return createRelativeUrl(`/d/${encodeURIComponent(dashboardUID)}`, panelParams);
}

export function makeEditContactPointLink(name: string, options?: Record<string, string>) {
  return createRelativeUrl(`/alerting/notifications/receivers/${encodeURIComponent(name)}/edit`, options);
}

export function makeEditTimeIntervalLink(name: string, options?: Record<string, string>) {
  return createRelativeUrl('/alerting/routes/mute-timing/edit', {
    ...options,
    muteName: name,
  });
}

// keep retrying fn if it's error passes shouldRetry(error) and timeout has not elapsed yet
export function retryWhile<T, E = Error>(
  fn: () => Promise<T>,
  shouldRetry: (e: E) => boolean,
  timeout: number, // milliseconds, how long to keep retrying
  pause = 1000 // milliseconds, pause between retries
): Promise<T> {
  const start = new Date().getTime();
  const makeAttempt = (): Promise<T> =>
    fn().catch((e) => {
      if (shouldRetry(e) && new Date().getTime() - start < timeout) {
        return new Promise((resolve) => setTimeout(resolve, pause)).then(makeAttempt);
      }
      throw e;
    });
  return makeAttempt();
}

const alertStateSortScore = {
  [GrafanaAlertState.Alerting]: 1,
  [PromAlertingRuleState.Firing]: 1,
  [GrafanaAlertState.Error]: 1,
  [GrafanaAlertState.Pending]: 2,
  [GrafanaAlertState.Recovering]: 2,
  [PromAlertingRuleState.Pending]: 2,
  [PromAlertingRuleState.Recovering]: 2,
  [PromAlertingRuleState.Inactive]: 2,
  [GrafanaAlertState.NoData]: 3,
  [GrafanaAlertState.Normal]: 4,
  [PromAlertingRuleState.Unknown]: 5,
};

export function sortAlerts(sortOrder: SortOrder, alerts: Alert[]): Alert[] {
  // Make sure to handle tie-breaks because API returns alert instances in random order every time
  if (sortOrder === SortOrder.Importance) {
    return sortBy(alerts, (alert) => [
      alertStateSortScore[mapStateWithReasonToBaseState(alert.state)],
      alertInstanceKey(alert).toLocaleLowerCase(),
    ]);
  } else if (sortOrder === SortOrder.TimeAsc) {
    return sortBy(alerts, (alert) => [
      new Date(alert.activeAt) || new Date(),
      alertInstanceKey(alert).toLocaleLowerCase(),
    ]);
  } else if (sortOrder === SortOrder.TimeDesc) {
    return sortBy(alerts, (alert) => [
      new Date(alert.activeAt) || new Date(),
      alertInstanceKey(alert).toLocaleLowerCase(),
    ]).reverse();
  }
  const result = sortBy(alerts, (alert) => alertInstanceKey(alert).toLocaleLowerCase());
  if (sortOrder === SortOrder.AlphaDesc) {
    result.reverse();
  }

  return result;
}

export function isOpenSourceEdition() {
  const buildInfo = config.buildInfo;
  return buildInfo.edition === GrafanaEdition.OpenSource;
}

export function isAdmin() {
  return contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;
}

export function isLocalDevEnv() {
  const buildInfo = config.buildInfo;
  return buildInfo.env === 'development';
}

export function isErrorLike(error: unknown): error is Error {
  return Boolean(error && typeof error === 'object' && 'message' in error);
}

export function getErrorCode(error: unknown): string | undefined {
  if (isApiMachineryError(error) && error.data.details) {
    return error.data.details.uid;
  }

  if (isErrorLike(error) && isString(error.cause)) {
    return error.cause;
  }

  return;
}

/* this function will check if the error passed as the first argument contains an error code */
export function isErrorMatchingCode(error: Error | undefined, code: KnownErrorCodes): boolean {
  if (!error) {
    return false;
  }

  return getErrorCode(error) === code;
}

export function stringifyErrorLike(error: unknown): string {
  const fetchError = isFetchError(error);
  if (fetchError) {
    if (isApiMachineryError(error)) {
      const message = getErrorMessageFromApiMachineryErrorResponse(error);
      if (message) {
        return message;
      }
    }

    if (error.message) {
      return error.message;
    }

    if ('message' in error.data && typeof error.data.message === 'string') {
      const status = getStatusFromError(error);
      const message = getMessageFromError(error);

      const config = getRequestConfigFromError(error);

      return t('alerting.errors.failedWith', '{{-config}} failed with {{status}}: {{-message}}', {
        config,
        status,
        message,
      });
    }

    if (error.statusText) {
      return error.statusText;
    }

    return String(error.status) || 'Unknown error';
  }

  if (!isErrorLike(error)) {
    return String(error);
  }

  // if the error is one we know how to translate via an error code:
  const code = getErrorCode(error);
  if (typeof code === 'string') {
    const message = getErrorMessageFromCode(code);
    if (message) {
      return message;
    }
  }

  if (error.cause) {
    return `${error.message}, cause: ${stringifyErrorLike(error.cause)}`;
  }

  return error.message;
}
