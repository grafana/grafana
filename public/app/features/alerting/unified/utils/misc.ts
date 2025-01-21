import { sortBy } from 'lodash';

import { UrlQueryMap, Labels } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/src/types/config';
import { config, isFetchError } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';
import { escapePathSeparators } from 'app/features/alerting/unified/utils/rule-id';
import { alertInstanceKey } from 'app/features/alerting/unified/utils/rules';
import { SortOrder } from 'app/plugins/panel/alertlist/types';
import { Alert, CombinedRule, FilterState, RulesSource, SilenceFilterState } from 'app/types/unified-alerting';
import {
  GrafanaAlertState,
  PromAlertingRuleState,
  mapStateWithReasonToBaseState,
} from 'app/types/unified-alerting-dto';

import { FolderDTO } from '../../../../types';

import { ALERTMANAGER_NAME_QUERY_KEY } from './constants';
import { getRulesSourceName, isCloudRulesSource } from './datasource';
import { getMatcherQueryParams } from './matchers';
import * as ruleId from './rule-id';
import { createAbsoluteUrl, createUrl } from './url';

export function createViewLink(ruleSource: RulesSource, rule: CombinedRule, returnTo: string): string {
  const sourceName = getRulesSourceName(ruleSource);
  const identifier = ruleId.fromCombinedRule(sourceName, rule);
  const paramId = encodeURIComponent(ruleId.stringifyIdentifier(identifier));
  const paramSource = encodeURIComponent(sourceName);

  return createUrl(`/alerting/${paramSource}/${paramId}/view`, { returnTo });
}

export function createExploreLink(datasource: DataSourceRef, query: string) {
  const { uid, type } = datasource;

  return createUrl(`/explore`, {
    left: JSON.stringify({
      datasource: datasource.uid,
      queries: [{ refId: 'A', datasource: { uid, type }, expr: query }],
      range: { from: 'now-1h', to: 'now' },
    }),
  });
}

export function createContactPointLink(contactPoint: string, alertManagerSourceName = ''): string {
  return createUrl(`/alerting/notifications/receivers/${encodeURIComponent(contactPoint)}/edit`, {
    alertmanager: alertManagerSourceName,
  });
}

export function createMuteTimingLink(muteTimingName: string, alertManagerSourceName = ''): string {
  return createUrl('/alerting/routes/mute-timing/edit', {
    muteName: muteTimingName,
    alertmanager: alertManagerSourceName,
  });
}

export function createShareLink(ruleSource: RulesSource, rule: CombinedRule): string {
  if (isCloudRulesSource(ruleSource)) {
    return createAbsoluteUrl(
      `/alerting/${encodeURIComponent(ruleSource.name)}/${encodeURIComponent(escapePathSeparators(rule.name))}/find`
    );
  }

  return window.location.href.split('?')[0];
}

export function arrayToRecord(items: Array<{ key: string; value: string }>): Record<string, string> {
  return items.reduce<Record<string, string>>((rec, { key, value }) => {
    rec[key] = value;
    return rec;
  }, {});
}

export const getFiltersFromUrlParams = (queryParams: UrlQueryMap): FilterState => {
  const queryString = queryParams['queryString'] === undefined ? undefined : String(queryParams['queryString']);
  const alertState = queryParams['alertState'] === undefined ? undefined : String(queryParams['alertState']);
  const dataSource = queryParams['dataSource'] === undefined ? undefined : String(queryParams['dataSource']);
  const ruleType = queryParams['ruleType'] === undefined ? undefined : String(queryParams['ruleType']);
  const groupBy = queryParams['groupBy'] === undefined ? undefined : String(queryParams['groupBy']).split(',');
  return { queryString, alertState, dataSource, groupBy, ruleType };
};

export const getNotificationPoliciesFilters = (searchParams: URLSearchParams) => {
  return {
    queryString: searchParams.get('queryString') ?? undefined,
    contactPoint: searchParams.get('contactPoint') ?? undefined,
  };
};

export const getSilenceFiltersFromUrlParams = (queryParams: UrlQueryMap): SilenceFilterState => {
  const queryString = queryParams['queryString'] === undefined ? undefined : String(queryParams['queryString']);
  const silenceState = queryParams['silenceState'] === undefined ? undefined : String(queryParams['silenceState']);

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

export function makeRuleBasedSilenceLink(alertManagerSourceName: string, rule: CombinedRule) {
  // we wrap the name of the alert with quotes since it might contain starting and trailing spaces
  const labels: Labels = {
    alertname: rule.name,
    ...rule.labels,
  };

  return makeLabelBasedSilenceLink(alertManagerSourceName, labels);
}

export function makeLabelBasedSilenceLink(alertManagerSourceName: string, labels: Labels) {
  const silenceUrlParams = new URLSearchParams();
  silenceUrlParams.append('alertmanager', alertManagerSourceName);

  const matcherParams = getMatcherQueryParams(labels);
  matcherParams.forEach((value, key) => silenceUrlParams.append(key, value));
  // LOGZ.IO GRAFANA CHANGE :: DEV-47948 - fix link
  return createUrl('alerting/silence/new', silenceUrlParams);
}

export function makeDataSourceLink(uid: string) {
  return createUrl(`/datasources/edit/${uid}`);
}

export function makeFolderLink(folderUID: string): string {
  // LOGZ.IO GRAFANA CHANGE :: DEV-47948 - fix links
  return createUrl(`dashboards/f/${folderUID}`);
}

export function makeFolderAlertsLink(folderUID: string, title: string): string {
  return createUrl(`/dashboards/f/${folderUID}/${title}/alerting`);
}

export function makeFolderSettingsLink(folder: FolderDTO): string {
  return createUrl(`/dashboards/f/${folder.uid}/settings`);
}

export function makeDashboardLink(dashboardUID: string): string {
  return createUrl(`/d/${encodeURIComponent(dashboardUID)}`);
}

type PanelLinkParams = {
  viewPanel?: string;
  editPanel?: string;
  tab?: 'alert' | 'transform' | 'query';
};

export function makePanelLink(dashboardUID: string, panelId: string, queryParams: PanelLinkParams = {}): string {
  const panelParams = new URLSearchParams(queryParams);
  return createUrl(`/d/${encodeURIComponent(dashboardUID)}`, panelParams);
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

export function isLocalDevEnv() {
  const buildInfo = config.buildInfo;
  return buildInfo.env === 'development';
}

export function isErrorLike(error: unknown): error is Error {
  return 'message' in (error as Error);
}

export function stringifyErrorLike(error: unknown): string {
  const fetchError = isFetchError(error);
  if (fetchError) {
    return error.data.message;
  }

  return isErrorLike(error) ? error.message : String(error);
}
