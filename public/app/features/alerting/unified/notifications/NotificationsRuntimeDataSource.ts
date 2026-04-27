import { useEffect, useMemo } from 'react';

import {
  type CreateNotificationqueryMatcher,
  type CreateNotificationqueryNotificationCount,
  type CreateNotificationqueryNotificationOutcome,
  type CreateNotificationqueryNotificationStatus,
  type CreateNotificationqueryResponse,
  generatedAPI as notificationsApi,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { type DataQueryRequest, type DataQueryResponse, type DataSourceGetTagKeysOptions, type DataSourceGetTagValuesOptions, type MetricFindValue, type TestDataSourceResponse } from '@grafana/data';
import { type DataFrame, type Field, FieldType } from '@grafana/data/dataframe';
import { t } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { RuntimeDataSource, sceneUtils } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { type Matcher } from 'app/plugins/datasource/alertmanager/types';
import { dispatch } from 'app/store/store';

import { type DataSourceInformation } from '../home/Insights';
import { matcherToOperator } from '../utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from '../utils/matchers';

// Helper function to convert Matcher to API format
export function matcherToAPIFormat(matcher: Matcher): CreateNotificationqueryMatcher {
  return {
    type: matcherToOperator(matcher),
    label: matcher.name,
    value: matcher.value,
  };
}

const VALID_STATUSES: string[] = ['firing', 'resolved'];
const VALID_OUTCOMES: string[] = ['success', 'error'];

export function isNotificationStatus(value: string): value is CreateNotificationqueryNotificationStatus {
  return VALID_STATUSES.includes(value);
}

export function isNotificationOutcome(value: string): value is CreateNotificationqueryNotificationOutcome {
  return VALID_OUTCOMES.includes(value);
}

const notificationsDataSourceUid = 'grafana-notifications-ds';
const notificationsDataSourcePluginId = 'grafana-notifications-plugin';

export const notificationsDatasource: DataSourceInformation = {
  type: notificationsDataSourcePluginId,
  uid: notificationsDataSourceUid,
  settings: undefined,
};

export function useRegisterNotificationsRuntimeDataSource() {
  const ds = useMemo(
    () => new NotificationsAPIDatasource(notificationsDataSourceUid, notificationsDataSourcePluginId),
    []
  );
  useEffect(() => {
    try {
      sceneUtils.registerRuntimeDataSource({ dataSource: ds });
    } catch (e) {
      // Datasource already registered
    }
  }, [ds]);
}

interface NotificationsAPIQuery extends DataQuery {
  statusFilter?: string;
  outcomeFilter?: string;
  receiverFilter?: string;
  labelFilter?: string;
  ruleUID?: string;
}

type NotificationRangeCount = CreateNotificationqueryNotificationCount;

/**
 * This class is a runtime datasource that fetches notification events from the notifications API.
 * The events are grouped by time interval and converted to a DataFrame for visualization.
 */
class NotificationsAPIDatasource extends RuntimeDataSource<NotificationsAPIQuery> {
  constructor(pluginId: string, uid: string) {
    super(uid, pluginId);
  }

  async query(request: DataQueryRequest<NotificationsAPIQuery>): Promise<DataQueryResponse> {
    const from = request.range.from.toISOString(); // Convert to ISO string
    const to = request.range.to.toISOString(); // Convert to ISO string

    const query = request.targets[0]!;
    const templateSrv = getTemplateSrv();

    // Get filter values from scene variables
    const statusFilter = templateSrv.replace(query.statusFilter ?? '', request.scopedVars);
    const outcomeFilter = templateSrv.replace(query.outcomeFilter ?? '', request.scopedVars);
    const receiverFilter = templateSrv.replace(query.receiverFilter ?? '', request.scopedVars);
    const labelFilter = templateSrv.replace(query.labelFilter ?? '', request.scopedVars);
    const ruleUID = templateSrv.replace(query.ruleUID ?? '', request.scopedVars) || undefined;

    // Convert label filter to API matchers
    let groupLabels: CreateNotificationqueryMatcher[] = [];
    if (labelFilter && labelFilter.trim()) {
      const matchers = parsePromQLStyleMatcherLooseSafe(labelFilter);
      groupLabels = matchers.map(matcherToAPIFormat);
    }

    const rangeCounts = await getNotificationsRangeCounts(
      from,
      to,
      isNotificationStatus(statusFilter) ? statusFilter : undefined,
      isNotificationOutcome(outcomeFilter) ? outcomeFilter : undefined,
      receiverFilter && receiverFilter !== 'all' ? receiverFilter : undefined,
      groupLabels,
      Math.round(request.intervalMs / 1000),
      ruleUID
    );

    const dataFrame = rangeCountsToDataFrame(rangeCounts);

    return {
      data: [dataFrame],
    };
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({
      status: 'success',
      message: t('alerting.notifications-runtime-datasource.message.data-source-is-working', 'Data source is working'),
      title: t('alerting.notifications-runtime-datasource.title.success', 'Success'),
    });
  }

  /**
   * Get available label keys for ad-hoc filters.
   * Returns common alerting label keys. Users can also type custom keys.
   */
  async getTagKeys(options?: DataSourceGetTagKeysOptions<NotificationsAPIQuery>): Promise<MetricFindValue[]> {
    // Return common alerting label keys
    const commonKeys = ['alertname', 'severity', 'namespace', 'cluster', 'job', 'instance', 'grafana_folder'];

    return commonKeys.map((key) => ({ text: key }));
  }

  /**
   * Get available values for a given label key.
   * Returns empty array to allow free-text entry.
   */
  async getTagValues(options: DataSourceGetTagValuesOptions<NotificationsAPIQuery>): Promise<MetricFindValue[]> {
    // Return empty array to allow users to type any value
    // In the future, we could query the API for actual values
    return [];
  }
}

// Track if datasource has been registered to avoid duplicate registration
let datasourceRegistered = false;

/**
 * Ensures the notifications runtime datasource is registered.
 * Can be called multiple times safely - only registers once.
 * Call this before creating any scenes that use the notifications datasource.
 */
export function ensureNotificationsDataSourceRegistered() {
  if (!datasourceRegistered) {
    try {
      const ds = new NotificationsAPIDatasource(notificationsDataSourceUid, notificationsDataSourcePluginId);
      sceneUtils.registerRuntimeDataSource({ dataSource: ds });
      datasourceRegistered = true;
    } catch (e) {
      // Datasource might already be registered, or registration failed
      datasourceRegistered = true;
    }
  }
}

/**
 * Fetch notification events from the notifications API
 */
export const getNotifications = async (
  from: string,
  to: string,
  status?: CreateNotificationqueryNotificationStatus,
  outcome?: CreateNotificationqueryNotificationOutcome,
  receiver?: string,
  groupLabels?: CreateNotificationqueryMatcher[],
  ruleUID?: string
): Promise<CreateNotificationqueryResponse> => {
  const result = await dispatch(
    notificationsApi.endpoints.createNotificationquery.initiate(
      {
        createNotificationqueryRequestBody: {
          from: from,
          to: to,
          limit: 1000,
          status: status,
          outcome: outcome,
          receiver: receiver,
          groupLabels: groupLabels || [],
          ruleUID: ruleUID,
        },
      },
      // @ts-expect-error forceRefetch is a valid RTK Query initiate option but not included in generated types
      { forceRefetch: Boolean(getTimeSrv().getAutoRefreshInteval().interval) }
    )
  ).unwrap();

  return result;
};

/**
 * Fetch notification range counts from the notifications API for graph visualization.
 */
export const getNotificationsRangeCounts = async (
  from: string,
  to: string,
  status?: CreateNotificationqueryNotificationStatus,
  outcome?: CreateNotificationqueryNotificationOutcome,
  receiver?: string,
  groupLabels?: CreateNotificationqueryMatcher[],
  step?: number,
  ruleUID?: string
): Promise<NotificationRangeCount[]> => {
  const result = await dispatch(
    notificationsApi.endpoints.createNotificationquery.initiate(
      {
        createNotificationqueryRequestBody: {
          type: 'range_counts',
          from: from,
          to: to,
          status: status,
          outcome: outcome,
          receiver: receiver,
          groupLabels: groupLabels || [],
          step: step,
          ruleUID: ruleUID,
        },
      },
      // @ts-expect-error forceRefetch is a valid RTK Query initiate option but not included in generated types
      { forceRefetch: Boolean(getTimeSrv().getAutoRefreshInteval().interval) }
    )
  ).unwrap();

  return result.counts ?? [];
};

/**
 * Convert notification range counts to a DataFrame for graph visualization.
 * Each range count series becomes a separate data frame series with timestamps in milliseconds.
 */
export function rangeCountsToDataFrame(rangeCounts: NotificationRangeCount[]): DataFrame {
  if (rangeCounts.length === 0) {
    return {
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [],
          config: { displayName: 'Time' },
        },
        {
          name: 'value',
          type: FieldType.number,
          values: [],
          config: {},
        },
      ],
      length: 0,
    };
  }

  // Use the first (and typically only) series from the range counts.
  // The range_counts query without groupBy returns a single aggregated series.
  const series = rangeCounts[0];
  const values = series.values ?? [];

  const timeField: Field = {
    name: 'time',
    type: FieldType.time,
    // Timestamps from Loki are Unix epoch seconds; convert to milliseconds for Grafana
    values: values.map((v) => v.timestamp * 1000),
    config: { displayName: 'Time' },
  };

  const countField: Field = {
    name: 'value',
    type: FieldType.number,
    values: values.map((v) => v.count),
    config: {},
  };

  return {
    fields: [timeField, countField],
    length: timeField.values.length,
  };
}
