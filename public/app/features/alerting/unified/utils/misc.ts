import { sortBy } from 'lodash';

import { Labels, UrlQueryMap } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/src/types/config';
import { config, isFetchError } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';
import { escapePathSeparators } from 'app/features/alerting/unified/utils/rule-id';
import { alertInstanceKey, isGrafanaRulerRule } from 'app/features/alerting/unified/utils/rules';
import { SortOrder } from 'app/plugins/panel/alertlist/types';
import { Alert, CombinedRule, FilterState, RulesSource, SilenceFilterState } from 'app/types/unified-alerting';
import {
  GrafanaAlertState,
  PromAlertingRuleState,
  mapStateWithReasonToBaseState,
} from 'app/types/unified-alerting-dto';

import { ALERTMANAGER_NAME_QUERY_KEY } from './constants';
import { getRulesSourceName, isCloudRulesSource } from './datasource';
import { getMatcherQueryParams } from './matchers';
import * as ruleId from './rule-id';
import { createAbsoluteUrl, createRelativeUrl } from './url';

export function createViewLink(ruleSource: RulesSource, rule: CombinedRule, returnTo?: string): string {
  const sourceName = getRulesSourceName(ruleSource);
  const identifier = ruleId.fromCombinedRule(sourceName, rule);
  const paramId = encodeURIComponent(ruleId.stringifyIdentifier(identifier));
  const paramSource = encodeURIComponent(sourceName);

  return createRelativeUrl(`/alerting/${paramSource}/${paramId}/view`, returnTo ? { returnTo } : {});
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

export function createMuteTimingLink(muteTimingName: string, alertManagerSourceName = ''): string {
  return createRelativeUrl('/alerting/routes/mute-timing/edit', {
    muteName: muteTimingName,
    alertmanager: alertManagerSourceName,
  });
}

export function createShareLink(ruleSource: RulesSource, rule: CombinedRule): string | undefined {
  if (isCloudRulesSource(ruleSource)) {
    return createAbsoluteUrl(
      `/alerting/${encodeURIComponent(ruleSource.name)}/${encodeURIComponent(escapePathSeparators(rule.name))}/find`
    );
  } else if (isGrafanaRulerRule(rule.rulerRule)) {
    return createAbsoluteUrl(`/alerting/grafana/${rule.rulerRule.grafana_alert.uid}/view`);
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
  return { queryString, alertState, dataSource, groupBy, ruleType };
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

export const escapeQuotes = (input: string) => input.replace(/\"/g, '\\"');

export function wrapWithQuotes(input: string) {
  const alreadyWrapped = input.startsWith('"') && input.endsWith('"');
  return alreadyWrapped ? escapeQuotes(input) : `"${escapeQuotes(input)}"`;
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
  [PromAlertingRuleState.Pending]: 2,
  [PromAlertingRuleState.Inactive]: 2,
  [GrafanaAlertState.NoData]: 3,
  [GrafanaAlertState.Normal]: 4,
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

export function stringifyErrorLike(error: unknown): string {
  const fetchError = isFetchError(error);
  if (fetchError) {
    if (error.message) {
      return error.message;
    }
    if ('message' in error.data && typeof error.data.message === 'string') {
      return error.data.message;
    }
    if (error.statusText) {
      return error.statusText;
    }

    return String(error.status) || 'Unknown error';
  }

  if (!isErrorLike(error)) {
    return String(error);
  }

  if (error.cause) {
    return `${error.message}, cause: ${stringifyErrorLike(error.cause)}`;
  }

  return error.message;
}
