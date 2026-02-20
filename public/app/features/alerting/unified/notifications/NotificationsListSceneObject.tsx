import { css, cx } from '@emotion/css';
import * as React from 'react';
import { useState } from 'react';
import { useMeasure } from 'react-use';

import { AlertLabels } from '@grafana/alerting/unstable';
import {
  CreateNotificationqueryMatcher,
  CreateNotificationqueryNotificationEntry,
  CreateNotificationqueryNotificationEntryAlert,
  useCreateNotificationqueryMutation,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { GrafanaTheme2, TimeRange, dateTime } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  AdHocFiltersVariable,
  CustomVariable,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  VariableDependencyConfig,
  sceneGraph,
} from '@grafana/scenes';
import {
  Alert,
  Badge,
  LoadingBar,
  Pagination,
  Stack,
  Text,
  TextLink,
  Tooltip,
  useStyles2,
  withErrorBoundary,
} from '@grafana/ui';

import { CollapseToggle } from '../components/CollapseToggle';
import { StateTag } from '../components/StateTag';
import { usePagination } from '../hooks/usePagination';
import { prometheusExpressionBuilder } from '../triage/scene/expressionBuilder';
import { parsePromQLStyleMatcherLooseSafe } from '../utils/matchers';
import { stringifyErrorLike } from '../utils/misc';

import { isNotificationOutcome, isNotificationStatus, matcherToAPIFormat } from './NotificationsRuntimeDataSource';
import { LABELS_FILTER, OUTCOME_FILTER, RECEIVER_FILTER, STATUS_FILTER } from './constants';

const PAGE_SIZE = 100;

// Use the generated type from the API client
type NotificationEntry = CreateNotificationqueryNotificationEntry;

interface NotificationsListProps {
  timeRange: TimeRange;
  labelFilter: string;
  statusFilter: string;
  outcomeFilter: string;
  receiverFilter: string;
  onLabelClick: ([value, key]: [string | undefined, string | undefined]) => void;
}

export const NotificationsList = React.memo(function NotificationsList({
  timeRange,
  labelFilter,
  statusFilter,
  outcomeFilter,
  receiverFilter,
  onLabelClick,
}: NotificationsListProps) {
  const [createNotificationQuery, { data, isLoading, isError, error }] = useCreateNotificationqueryMutation();

  // Fetch notifications when filters change
  React.useEffect(() => {
    // Guard checks
    if (!timeRange?.from || !timeRange?.to) {
      return;
    }

    if (typeof timeRange.from.unix !== 'function' || typeof timeRange.to.unix !== 'function') {
      return;
    }

    try {
      const fromDate = timeRange.from.toISOString();
      const toDate = timeRange.to.toISOString();

      // Convert label filter to API matchers
      let groupLabels: CreateNotificationqueryMatcher[] = [];
      if (labelFilter && labelFilter.trim()) {
        const matchers = parsePromQLStyleMatcherLooseSafe(labelFilter);
        groupLabels = matchers.map(matcherToAPIFormat);
      }

      createNotificationQuery({
        createNotificationqueryRequestBody: {
          from: fromDate,
          to: toDate,
          limit: 1000,
          status: isNotificationStatus(statusFilter) ? statusFilter : undefined,
          outcome: isNotificationOutcome(outcomeFilter) ? outcomeFilter : undefined,
          receiver: receiverFilter && receiverFilter !== 'all' ? receiverFilter : undefined,
          groupLabels,
        },
      });
    } catch {
      // Error is handled by the RTK Query isError state
    }
    // Don't include createNotificationQuery in deps to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange?.from?.unix(), timeRange?.to?.unix(), statusFilter, outcomeFilter, receiverFilter, labelFilter]);

  // Extract entries from API response (data is properly typed from the generated client)
  const entriesArray: NotificationEntry[] = React.useMemo(() => {
    const entries = data?.entries ?? [];
    // Create a shallow copy to avoid mutating read-only array and sort by timestamp descending
    return [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [data?.entries]);

  if (isError) {
    const errorMessage = error
      ? stringifyErrorLike(error)
      : t('alerting.notifications-list.unable-to-fetch', 'Unable to fetch notification history');

    return (
      <Alert title={t('alerting.notifications-list.error-fetching', 'Error fetching notifications')} severity="error">
        {errorMessage}
      </Alert>
    );
  }

  return (
    <Stack direction="column" gap={0.5}>
      <LoadingIndicator visible={isLoading} />
      <NotificationsLogEvents logRecords={entriesArray} onLabelClick={onLabelClick} />
    </Stack>
  );
});

const LoadingIndicator = ({ visible = false }) => {
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();
  return <div ref={measureRef}>{visible && <LoadingBar width={width} data-testid="loading-bar" />}</div>;
};

interface NotificationsLogEventsProps {
  logRecords: NotificationEntry[];
  onLabelClick: ([value, key]: [string | undefined, string | undefined]) => void;
}

function NotificationsLogEvents({ logRecords, onLabelClick }: NotificationsLogEventsProps) {
  const { page, pageItems, numberOfPages, onPageChange } = usePagination(logRecords, 1, PAGE_SIZE);
  const styles = useStyles2(getStyles);

  if (logRecords.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Text color="secondary">
          <Trans i18nKey="alerting.notifications-scene.no-notifications">
            No notifications found for the selected time range and filters
          </Trans>
        </Text>
      </div>
    );
  }

  return (
    <Stack direction="column" gap={0}>
      <ListHeader />
      <ul className={styles.list}>
        {pageItems.map((record, index) => {
          return <NotificationRow key={`${record.timestamp}-${index}`} record={record} onLabelClick={onLabelClick} />;
        })}
      </ul>
      <Pagination currentPage={page} numberOfPages={numberOfPages} onNavigate={onPageChange} hideWhenSinglePage />
    </Stack>
  );
}

function ListHeader() {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.mainHeader}>
      <div className={styles.timeCol}>
        <Text variant="body">
          <Trans i18nKey="alerting.notifications-scene.header.time">Time</Trans>
        </Text>
      </div>
      <div className={styles.stateCol}>
        <Text variant="body">
          <Trans i18nKey="alerting.notifications-scene.header.status">Status</Trans>
        </Text>
      </div>
      <div className={styles.labelsCol}>
        <Text variant="body">
          <Trans i18nKey="alerting.notifications-scene.header.group-labels">Group Labels</Trans>
        </Text>
      </div>
      <div className={styles.statusCol}>{/* Status badge column */}</div>
      <div className={styles.receiverCol}>
        <Text variant="body">
          <Trans i18nKey="alerting.notifications-scene.header.contact-point">Contact point</Trans>
        </Text>
      </div>
    </div>
  );
}

interface NotificationRowProps {
  record: NotificationEntry;
  onLabelClick: ([value, key]: [string | undefined, string | undefined]) => void;
}

function NotificationRow({ record, onLabelClick }: NotificationRowProps) {
  const styles = useStyles2(getStyles);
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <Stack direction="column" gap={0}>
      <div
        className={cx(styles.header, isCollapsed ? styles.collapsedHeader : styles.notCollapsedHeader)}
        data-testid="notification-row-header"
      >
        <CollapseToggle
          size="sm"
          className={styles.collapseToggle}
          isCollapsed={isCollapsed}
          onToggle={setIsCollapsed}
        />
        <div className={styles.timeCol}>
          <Timestamp time={record.timestamp} />
        </div>
        <div className={styles.stateCol}>
          <NotificationState status={record.status} />
        </div>
        <div className={styles.labelsCol}>
          {record.groupLabels && Object.keys(record.groupLabels).length > 0 ? (
            <AlertLabels labels={record.groupLabels} size="xs" onClick={onLabelClick} />
          ) : (
            <Text>-</Text>
          )}
        </div>
        <div className={styles.statusCol}>
          {record.outcome === 'error' && (
            <Tooltip
              content={record.error || t('alerting.notifications-list.no-error-details', 'No error details available')}
            >
              <span>
                <Badge
                  color="orange"
                  icon="exclamation-triangle"
                  text={t('alerting.notifications-list.outcome-failed', 'Failed')}
                />
              </span>
            </Tooltip>
          )}
        </div>
        <div className={styles.receiverCol}>
          <Text>{record.receiver || '-'}</Text>
        </div>
      </div>
      {!isCollapsed && (
        <div className={styles.expandedRow}>
          <NotificationDetails record={record} />
        </div>
      )}
    </Stack>
  );
}

interface NotificationStateProps {
  status: 'firing' | 'resolved';
}

function NotificationState({ status }: NotificationStateProps) {
  const isFiring = status === 'firing';
  const statusText = isFiring
    ? t('alerting.notifications-list.status-firing', 'Firing')
    : t('alerting.notifications-list.status-resolved', 'Resolved');
  const state = isFiring ? 'bad' : 'good';
  return <StateTag state={state}>{statusText}</StateTag>;
}

interface NotificationDetailsProps {
  record: NotificationEntry;
}

function NotificationDetails({ record }: NotificationDetailsProps) {
  const styles = useStyles2(getStyles);

  // Split alerts into firing and resolved
  const firingAlerts = record.alerts.filter(
    (alert: CreateNotificationqueryNotificationEntryAlert) => alert.status === 'firing'
  );
  const resolvedAlerts = record.alerts.filter(
    (alert: CreateNotificationqueryNotificationEntryAlert) => alert.status === 'resolved'
  );

  const renderAlert = (alert: CreateNotificationqueryNotificationEntryAlert, index: number) => {
    const ruleUid = alert.labels?.__alert_rule_uid__;
    const alertName = alert.labels?.alertname || 'Alert';
    const folderName = alert.labels?.grafana_folder || '';
    const linkText = folderName ? `${folderName} / ${alertName}` : alertName;
    const ruleLink = ruleUid ? `/alerting/grafana/${ruleUid}/view` : undefined;

    // Filter out labels that are already in groupLabels
    // Also filter out grafana_folder as it's redundant and always the same for a single alert
    const filteredLabels = alert.labels
      ? Object.keys(alert.labels).reduce((acc: Record<string, string>, key: string) => {
          if (key !== 'grafana_folder' && (!record.groupLabels || !(key in record.groupLabels))) {
            acc[key] = alert.labels[key];
          }
          return acc;
        }, {})
      : {};
    const hasFilteredLabels = Object.keys(filteredLabels).length > 0;

    // Extract summary and description annotations separately if they exist
    const summary = alert.annotations?.summary;
    const description = alert.annotations?.description;
    const otherAnnotations = alert.annotations
      ? Object.keys(alert.annotations).reduce((acc: Record<string, string>, key: string) => {
          if (key !== 'summary' && key !== 'description') {
            acc[key] = alert.annotations[key];
          }
          return acc;
        }, {})
      : {};
    const hasOtherAnnotations = Object.keys(otherAnnotations).length > 0;

    return (
      <div key={index} className={styles.alertDetail}>
        <Stack direction="column" gap={1}>
          <Stack direction="row" gap={2} alignItems="center">
            {ruleLink ? (
              <TextLink href={ruleLink} color="primary" inline={false}>
                {linkText}
              </TextLink>
            ) : (
              <Text>{linkText}</Text>
            )}
          </Stack>
          {hasFilteredLabels && (
            <Stack direction="row" gap={1} alignItems="center">
              <Text variant="bodySmall" color="secondary">
                <strong>
                  <Trans i18nKey="alerting.notifications-scene.labels">Labels:</Trans>
                </strong>
              </Text>
              <AlertLabels labels={filteredLabels} size="sm" />
            </Stack>
          )}
          {hasOtherAnnotations && (
            <Stack direction="row" gap={1} alignItems="center">
              <Text variant="bodySmall" color="secondary">
                <strong>
                  <Trans i18nKey="alerting.notifications-scene.annotations">Annotations:</Trans>
                </strong>
              </Text>
              <AlertLabels labels={otherAnnotations} size="sm" />
            </Stack>
          )}
          {summary && (
            <Text variant="bodySmall" color="secondary">
              <strong>
                <Trans i18nKey="alerting.notifications-scene.summary">Summary:</Trans>
              </strong>{' '}
              {summary}
            </Text>
          )}
          {description && (
            <Text variant="bodySmall" color="secondary">
              <strong>
                <Trans i18nKey="alerting.notifications-scene.description">Description:</Trans>
              </strong>{' '}
              {description}
            </Text>
          )}
          {alert.startsAt && (
            <Text variant="bodySmall" color="secondary">
              <Trans
                i18nKey="alerting.notifications-scene.started"
                values={{ value: dateTime(alert.startsAt).format('YYYY-MM-DD HH:mm:ss') }}
              >
                Started: {{ value: dateTime(alert.startsAt).format('YYYY-MM-DD HH:mm:ss') }}
              </Trans>
            </Text>
          )}
        </Stack>
      </div>
    );
  };

  return (
    <Stack direction="column" gap={2}>
      {record.error && (
        <Alert title={t('alerting.notifications-list.notification-error', 'Notification Error')} severity="warning">
          {record.error}
        </Alert>
      )}
      {/* Firing alerts section */}
      {firingAlerts.length > 0 && (
        <Stack direction="column" gap={2}>
          <Text variant="h6">
            <Trans i18nKey="alerting.notifications-scene.firing-alerts" values={{ count: firingAlerts.length }}>
              Firing Alerts ({{ count: firingAlerts.length }})
            </Trans>
          </Text>
          {firingAlerts.map(renderAlert)}
        </Stack>
      )}
      {/* Resolved alerts section */}
      {resolvedAlerts.length > 0 && (
        <Stack direction="column" gap={2}>
          <Text variant="h6">
            <Trans i18nKey="alerting.notifications-scene.resolved-alerts" values={{ count: resolvedAlerts.length }}>
              Resolved Alerts ({{ count: resolvedAlerts.length }})
            </Trans>
          </Text>
          {resolvedAlerts.map(renderAlert)}
        </Stack>
      )}
    </Stack>
  );
}

interface TimestampProps {
  time: string; // timestamp as ISO string
}

const Timestamp = ({ time }: TimestampProps) => {
  const formattedDate = time ? dateTime(time).format('YYYY-MM-DD HH:mm:ss') : '-';

  return (
    <Text variant="body" weight="light">
      {formattedDate}
    </Text>
  );
};

export default withErrorBoundary(NotificationsList, { style: 'page' });

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: `${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)} 0`,
      flexWrap: 'nowrap',
      gap: theme.spacing(0.5),
      '&:hover': {
        backgroundColor: theme.components.table.rowHoverBackground,
      },
    }),
    collapsedHeader: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    notCollapsedHeader: css({
      borderBottom: 'none',
    }),
    collapseToggle: css({
      background: 'none',
      border: 'none',
      marginTop: `-${theme.spacing(1)}`,
      marginBottom: `-${theme.spacing(1)}`,

      svg: {
        marginBottom: 0,
      },
    }),
    timeCol: css({
      width: '180px',
    }),
    stateCol: css({
      width: '100px',
    }),
    labelsCol: css({
      display: 'flex',
      overflow: 'hidden',
      alignItems: 'center',
      paddingRight: theme.spacing(2),
      flex: 1,
    }),
    statusCol: css({
      width: '100px',
      display: 'flex',
    }),
    receiverCol: css({
      width: '250px',
    }),
    expandedRow: css({
      padding: theme.spacing(2),
      marginLeft: theme.spacing(2),
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    }),
    mainHeader: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'nowrap',
      marginLeft: '30px',
      padding: `${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)} 0`,
      gap: theme.spacing(0.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    list: css({
      listStyle: 'none',
      padding: 0,
      margin: 0,
    }),
    emptyState: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(4),
    }),
    alertDetail: css({
      padding: theme.spacing(1.5),
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
    }),
  };
};

/**
 * This is a scene object that displays a list of notification events.
 */
interface NotificationsListObjectState extends SceneObjectState {}

export class NotificationsListObject extends SceneObjectBase<NotificationsListObjectState> {
  public static Component = NotificationsListObjectRenderer;

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [LABELS_FILTER, STATUS_FILTER, OUTCOME_FILTER, RECEIVER_FILTER],
  });
}

export function NotificationsListObjectRenderer({ model }: SceneComponentProps<NotificationsListObject>) {
  model.useState();

  const timeRangeObj = sceneGraph.getTimeRange(model);
  const { value: timeRange } = timeRangeObj.useState();

  const labelsFilterVariable = sceneGraph.lookupVariable(LABELS_FILTER, model);
  const statusFilterVariable = sceneGraph.lookupVariable(STATUS_FILTER, model);
  const outcomeFilterVariable = sceneGraph.lookupVariable(OUTCOME_FILTER, model);
  const receiverFilterVariable = sceneGraph.lookupVariable(RECEIVER_FILTER, model);

  // Ensure we have valid time range before rendering
  if (!timeRange || !timeRange.from || !timeRange.to) {
    return null;
  }

  if (
    labelsFilterVariable instanceof AdHocFiltersVariable &&
    statusFilterVariable instanceof CustomVariable &&
    outcomeFilterVariable instanceof CustomVariable &&
    receiverFilterVariable instanceof CustomVariable
  ) {
    const onLabelClick = ([value, key]: [string | undefined, string | undefined]) => {
      if (!key || !value) {
        return;
      }

      // Add the clicked label as a new filter
      const currentFilters = labelsFilterVariable.state.filters || [];
      const newFilter = {
        key: key,
        operator: '=',
        value: value,
      };

      // Check if this filter already exists
      const filterExists = currentFilters.some(
        (f) => f.key === newFilter.key && f.operator === newFilter.operator && f.value === newFilter.value
      );

      if (!filterExists) {
        labelsFilterVariable.setState({
          filters: [...currentFilters, newFilter],
        });
      }
    };

    // Use the expression builder to convert filters to PromQL-style matcher string
    // This handles multi-value operators (=|, !=|) and regex escaping correctly
    const labelFilter = prometheusExpressionBuilder(labelsFilterVariable.state.filters);

    return (
      <NotificationsList
        timeRange={timeRange}
        labelFilter={labelFilter}
        statusFilter={statusFilterVariable.state.value.toString()}
        outcomeFilter={outcomeFilterVariable.state.value.toString()}
        receiverFilter={receiverFilterVariable.state.value.toString()}
        onLabelClick={onLabelClick}
      />
    );
  } else {
    return null;
  }
}
