import { groupBy } from 'lodash';
import { useEffect, useMemo } from 'react';

import {
  CreateNotificationqueryMatcher,
  CreateNotificationqueryNotificationEntry,
  CreateNotificationqueryNotificationOutcome,
  CreateNotificationqueryNotificationStatus,
  CreateNotificationqueryResponse,
  generatedAPI as notificationsApi,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
  Field,
  FieldType,
  MetricFindValue,
  TestDataSourceResponse,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { RuntimeDataSource, sceneUtils } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { dispatch } from 'app/store/store';

import { DataSourceInformation } from '../home/Insights';
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
}

// Use the generated type from the API client
type NotificationEntry = CreateNotificationqueryNotificationEntry;

const GROUPING_INTERVAL = 10 * 1000; // 10 seconds

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

    // Convert label filter to API matchers
    let groupLabels: CreateNotificationqueryMatcher[] = [];
    if (labelFilter && labelFilter.trim()) {
      const matchers = parsePromQLStyleMatcherLooseSafe(labelFilter);
      groupLabels = matchers.map(matcherToAPIFormat);
    }

    const notificationResult = await getNotifications(
      from,
      to,
      isNotificationStatus(statusFilter) ? statusFilter : undefined,
      isNotificationOutcome(outcomeFilter) ? outcomeFilter : undefined,
      receiverFilter && receiverFilter !== 'all' ? receiverFilter : undefined,
      groupLabels
    );

    const dataFrame = notificationsToDataFrame(notificationResult);

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
  groupLabels?: CreateNotificationqueryMatcher[]
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
        },
      },
      // @ts-expect-error forceRefetch is a valid RTK Query initiate option but not included in generated types
      { forceRefetch: Boolean(getTimeSrv().getAutoRefreshInteval().interval) }
    )
  ).unwrap();

  return result;
};

/**
 * Convert notification entries to a DataFrame for visualization.
 * Groups notifications by time interval and counts them.
 */
export function notificationsToDataFrame(notificationResult: { entries: NotificationEntry[] }): DataFrame {
  // Extract entries from API response (properly typed from the generated client)
  const entriesArray = notificationResult.entries ?? [];

  if (entriesArray.length === 0) {
    // Return empty DataFrame
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

  // Extract timestamps and convert from ISO strings to milliseconds
  const timestamps = entriesArray.map((entry) => new Date(entry.timestamp).getTime());

  // Group timestamps by interval
  const groupedTimestamps = groupBy(
    timestamps,
    (time: number) => Math.floor(time / GROUPING_INTERVAL) * GROUPING_INTERVAL
  );

  // Create time field with grouped time values
  const timeField: Field = {
    name: 'time',
    type: FieldType.time,
    values: Object.keys(groupedTimestamps).map(Number),
    config: { displayName: 'Time' },
  };

  // Create count field with count of notifications in each group
  const countField: Field = {
    name: 'value',
    type: FieldType.number,
    values: Object.values(groupedTimestamps).map((group) => group.length),
    config: {},
  };

  return {
    fields: [timeField, countField],
    length: timeField.values.length,
  };
}
