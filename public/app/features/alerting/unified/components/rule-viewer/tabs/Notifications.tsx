import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';

import { AlertLabels } from '@grafana/alerting/unstable';
import {
  CreateNotificationqueryNotificationEntry,
  CreateNotificationqueryNotificationEntryAlert,
  CreateNotificationqueryNotificationOutcome,
  CreateNotificationqueryNotificationStatus,
  useCreateNotificationqueryMutation,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { dateTime } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  Badge,
  Box,
  Icon,
  Input,
  Label,
  LoadingPlaceholder,
  RadioButtonGroup,
  Stack,
  Text,
  Tooltip,
} from '@grafana/ui';
import { RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { matcherToOperator } from '../../../utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from '../../../utils/matchers';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../../DynamicTable';
import { StateTag } from '../../StateTag';

const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_PAGE_SIZE = 100;
const DEBOUNCE_MS = 300;

interface NotificationsProps {
  rule: RulerGrafanaRuleDTO;
}

// Use the generated type from the API client
type NotificationEntry = CreateNotificationqueryNotificationEntry;

type NotificationTableColumnProps = DynamicTableColumnProps<NotificationEntry>;
type NotificationTableItemProps = DynamicTableItemProps<NotificationEntry>;

type StatusFilter = CreateNotificationqueryNotificationStatus;
type OutcomeFilter = CreateNotificationqueryNotificationOutcome;

const Notifications = ({ rule }: NotificationsProps) => {
  const ruleUID = rule.grafana_alert.uid;

  const [labelFilter, setLabelFilter] = useState('');
  const [debouncedLabelFilter, setDebouncedLabelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter | undefined>();
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter | undefined>();

  // Debounce label filter to avoid excessive API calls on each keystroke
  useDebounce(
    () => {
      setDebouncedLabelFilter(labelFilter);
    },
    DEBOUNCE_MS,
    [labelFilter]
  );

  const [createNotificationQuery, { data, isLoading, isError, error }] = useCreateNotificationqueryMutation();

  // Fetch notifications when filters change
  useEffect(() => {
    const fromDate = dateTime().subtract(DEFAULT_LOOKBACK_DAYS, 'days').toISOString();
    const toDate = dateTime().toISOString();

    // Convert label filter to API matchers
    const matchers = parsePromQLStyleMatcherLooseSafe(debouncedLabelFilter);
    const groupLabels = matchers.map((matcher) => ({
      type: matcherToOperator(matcher),
      label: matcher.name,
      value: matcher.value,
    }));

    createNotificationQuery({
      createNotificationqueryRequestBody: {
        ruleUID,
        from: fromDate,
        to: toDate,
        limit: DEFAULT_PAGE_SIZE,
        status: statusFilter,
        outcome: outcomeFilter,
        groupLabels,
      },
    });
  }, [createNotificationQuery, ruleUID, statusFilter, outcomeFilter, debouncedLabelFilter]);

  // Extract entries from API response (data is properly typed from the generated client)
  const entriesArray: NotificationEntry[] = useMemo(() => {
    return data?.entries ?? [];
  }, [data]);

  // Prepare table items
  const items: NotificationTableItemProps[] = entriesArray.map((entry, index) => ({
    data: entry,
    id: `${entry.timestamp}-${index}`,
  }));

  // Define table columns
  const columns: NotificationTableColumnProps[] = useMemo(
    () => [
      {
        id: 'time',
        label: t('alerting.notification-history.column.time', 'Time'),
        renderCell: function TimeCell({ data }) {
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings -- date format and dash are not translatable
          return <span>{data.timestamp ? dateTime(data.timestamp).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>;
        },
        size: '180px',
      },
      {
        id: 'state',
        label: t('alerting.notification-history.column.state', 'State'),
        renderCell: function StateCell({ data }) {
          const isFiring = data.status === 'firing';
          const statusText = isFiring
            ? t('alerting.notification-history.status.firing', 'Firing')
            : t('alerting.notification-history.status.resolved', 'Resolved');
          const state = isFiring ? 'bad' : 'good';
          return <StateTag state={state}>{statusText}</StateTag>;
        },
        size: '100px',
      },
      {
        id: 'groupLabels',
        label: t('alerting.notification-history.column.group-labels', 'Group Labels'),
        renderCell: function GroupLabelsCell({ data }) {
          const onLabelClick = ([value, label]: [string | undefined, string | undefined]) => {
            if (label && value) {
              setLabelFilter(`{${label}="${value}"}`);
            }
          };

          // Filter out alertname as it's redundant (already shown as the rule name)
          const filteredGroupLabels = Object.fromEntries(
            Object.entries(data.groupLabels).filter(([key]) => key !== 'alertname')
          );

          if (Object.keys(filteredGroupLabels).length === 0) {
            return <span>-</span>;
          }
          return <AlertLabels labels={filteredGroupLabels} size="xs" onClick={onLabelClick} />;
        },
      },
      {
        id: 'status',
        label: '',
        renderCell: function StatusCell({ data }) {
          return (
            <Box display="flex" justifyContent="flex-end">
              {data.outcome === 'error' && (
                <Badge
                  color="orange"
                  icon="exclamation-triangle"
                  text={t('alerting.notification-history.outcome.failed', 'Failed')}
                />
              )}
            </Box>
          );
        },
        size: '100px',
      },
      {
        id: 'receiver',
        label: t('alerting.notification-history.column.contact-point', 'Contact point'),
        renderCell: function ReceiverCell({ data }) {
          return <span>{data.receiver || '-'}</span>;
        },
        size: '200px',
      },
    ],
    [setLabelFilter]
  );

  // Render content based on loading/error state
  let content;

  if (isLoading) {
    content = <LoadingPlaceholder text={t('alerting.notification-history.loading', 'Loading notifications...')} />;
  } else if (isError) {
    let errorMessage = t('alerting.notification-history.error.default', 'Unable to fetch notification history');

    if (error) {
      if (typeof error === 'object' && error !== null && 'data' in error) {
        const { data: errorData } = error;
        if (typeof errorData === 'object' && errorData !== null && 'message' in errorData) {
          errorMessage = String(errorData.message);
        } else {
          errorMessage = JSON.stringify(errorData);
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
    }

    content = (
      <Alert title={t('alerting.notification-history.error.title', 'Error fetching notifications')} severity="error">
        {errorMessage}
      </Alert>
    );
  } else if (entriesArray.length === 0) {
    const hasActiveFilters = debouncedLabelFilter || statusFilter || outcomeFilter;
    content = (
      <Box display="flex" alignItems="center" justifyContent="center" padding={4}>
        <Text color="secondary">
          {hasActiveFilters
            ? t(
                'alerting.notification-history.empty-filtered',
                'No notifications match the current filters for the last {{days}} days',
                { days: DEFAULT_LOOKBACK_DAYS }
              )
            : t(
                'alerting.notification-history.empty',
                'No notifications have been sent for this alert rule in the last {{days}} days',
                { days: DEFAULT_LOOKBACK_DAYS }
              )}
        </Text>
      </Box>
    );
  } else {
    content = (
      <DynamicTable
        cols={columns}
        isExpandable={true}
        items={items}
        renderExpandedContent={({ data }) => <NotificationExpandedContent entry={data} />}
      />
    );
  }

  return (
    <>
      <NotificationFilters
        labelFilter={labelFilter}
        onLabelFilterChange={setLabelFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        outcomeFilter={outcomeFilter}
        onOutcomeFilterChange={setOutcomeFilter}
      />
      {content}
    </>
  );
};

interface NotificationFiltersProps {
  labelFilter: string;
  onLabelFilterChange: (value: string) => void;
  statusFilter: StatusFilter | undefined;
  onStatusFilterChange: (value: StatusFilter | undefined) => void;
  outcomeFilter: OutcomeFilter | undefined;
  onOutcomeFilterChange: (value: OutcomeFilter | undefined) => void;
}

const NotificationFilters = ({
  labelFilter,
  onLabelFilterChange,
  statusFilter,
  onStatusFilterChange,
  outcomeFilter,
  onOutcomeFilterChange,
}: NotificationFiltersProps) => {
  return (
    <Box marginBottom={2}>
      <Stack direction="row" gap={2} alignItems="flex-end">
        <Stack direction="column" gap={0.5}>
          <Label>
            <Stack gap={0.5} alignItems="center">
              <span>{t('alerting.notification-history.filter.label', 'Filter notifications')}</span>
              <Tooltip
                content={
                  <div>
                    {t(
                      'alerting.notification-history.filter.tooltip',
                      'Use label matcher expression or click on a group label to filter instances, for example:'
                    )}
                    <div>
                      <code>{'{foo=bar}'}</code>
                    </div>
                  </div>
                }
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
          </Label>
          <Input
            placeholder={t('alerting.notification-history.filter.placeholder', 'Search labels...')}
            value={labelFilter}
            onChange={(e) => onLabelFilterChange(e.currentTarget.value)}
            width={30}
            prefix={<Icon name="search" />}
          />
        </Stack>
        <Stack direction="column" gap={0.5}>
          <Label>{t('alerting.notification-history.filter.status', 'Status')}</Label>
          <RadioButtonGroup
            options={[
              {
                label: t('alerting.notification-history.status.firing', 'Firing'),
                value: 'firing' as const,
              },
              {
                label: t('alerting.notification-history.status.resolved', 'Resolved'),
                value: 'resolved' as const,
              },
            ]}
            value={statusFilter}
            onChange={onStatusFilterChange}
            onClick={(v) => {
              if (v === statusFilter) {
                onStatusFilterChange(undefined);
              }
            }}
          />
        </Stack>
        <Stack direction="column" gap={0.5}>
          <Label>{t('alerting.notification-history.filter.outcome', 'Outcome')}</Label>
          <RadioButtonGroup
            options={[
              {
                label: t('alerting.notification-history.outcome.success', 'Success'),
                value: 'success' as const,
              },
              {
                label: t('alerting.notification-history.outcome.failed', 'Failed'),
                value: 'error' as const,
              },
            ]}
            value={outcomeFilter}
            onChange={onOutcomeFilterChange}
            onClick={(v) => {
              if (v === outcomeFilter) {
                onOutcomeFilterChange(undefined);
              }
            }}
          />
        </Stack>
      </Stack>
    </Box>
  );
};

interface NotificationExpandedContentProps {
  entry: NotificationEntry;
}

const NotificationExpandedContent = ({ entry }: NotificationExpandedContentProps) => {
  const firingAlerts =
    entry.alerts?.filter((alert: CreateNotificationqueryNotificationEntryAlert) => alert.status === 'firing') ?? [];
  const resolvedAlerts =
    entry.alerts?.filter((alert: CreateNotificationqueryNotificationEntryAlert) => alert.status === 'resolved') ?? [];

  return (
    <Box padding={2}>
      <Stack direction="column" gap={2}>
        {entry.error && (
          <Alert title={t('alerting.notification-history.notification-error', 'Notification Error')} severity="warning">
            {entry.error}
          </Alert>
        )}
        {firingAlerts.length > 0 && (
          <Stack direction="column" gap={2}>
            <Text variant="h6">
              {t('alerting.notification-history.firing-alerts', 'Firing Alerts ({{count}})', {
                count: firingAlerts.length,
              })}
            </Text>
            {firingAlerts.map((alert, index) => (
              <AlertDetail key={index} alert={alert} groupLabels={entry.groupLabels} />
            ))}
          </Stack>
        )}
        {resolvedAlerts.length > 0 && (
          <Stack direction="column" gap={2}>
            <Text variant="h6">
              {t('alerting.notification-history.resolved-alerts', 'Resolved Alerts ({{count}})', {
                count: resolvedAlerts.length,
              })}
            </Text>
            {resolvedAlerts.map((alert, index) => (
              <AlertDetail key={index} alert={alert} groupLabels={entry.groupLabels} />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

interface AlertDetailProps {
  alert: CreateNotificationqueryNotificationEntryAlert;
  groupLabels: Record<string, string>;
}

const AlertDetail = ({ alert, groupLabels }: AlertDetailProps) => {
  // Filter out labels that are already in groupLabels
  // Also filter out grafana_folder as it's redundant and always the same for a single alert
  const uniqueLabels = Object.fromEntries(
    Object.entries(alert.labels).filter(([key]) => key !== 'grafana_folder' && !(key in groupLabels))
  );
  const hasUniqueLabels = Object.keys(uniqueLabels).length > 0;

  // Extract summary and description annotations separately
  const { summary, description, ...otherAnnotations } = alert.annotations;
  const hasOtherAnnotations = Object.keys(otherAnnotations).length > 0;

  return (
    <Box padding={1.5} backgroundColor="secondary" borderRadius="default" borderStyle="solid" borderColor="weak">
      <Stack direction="column" gap={1}>
        {hasUniqueLabels && (
          <Stack direction="row" gap={1} alignItems="center">
            <Text variant="bodySmall" color="secondary">
              <strong>{t('alerting.notification-history.labels', 'Labels:')}</strong>
            </Text>
            <AlertLabels labels={uniqueLabels} size="sm" />
          </Stack>
        )}
        {hasOtherAnnotations && (
          <Stack direction="row" gap={1} alignItems="center">
            <Text variant="bodySmall" color="secondary">
              <strong>{t('alerting.notification-history.annotations', 'Annotations:')}</strong>
            </Text>
            <AlertLabels labels={otherAnnotations} size="sm" />
          </Stack>
        )}
        {summary && (
          <Text variant="bodySmall" color="secondary">
            <strong>{t('alerting.notification-history.summary', 'Summary:')}</strong> {summary}
          </Text>
        )}
        {description && (
          <Text variant="bodySmall" color="secondary">
            <strong>{t('alerting.notification-history.description', 'Description:')}</strong> {description}
          </Text>
        )}
        {alert.startsAt && (
          <Text variant="bodySmall" color="secondary">
            {t('alerting.notification-history.started', 'Started:')}{' '}
            {dateTime(alert.startsAt).format('YYYY-MM-DD HH:mm:ss')}
          </Text>
        )}
      </Stack>
    </Box>
  );
};

export { Notifications };
