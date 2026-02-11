import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { AlertLabels } from '@grafana/alerting/unstable';
import {
  useCreateNotificationqueryMutation,
  CreateNotificationqueryNotificationEntry,
  CreateNotificationqueryNotificationStatus,
  CreateNotificationqueryNotificationOutcome
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { GrafanaTheme2, dateTime } from '@grafana/data';
import { Alert, Badge, Icon, Input, Label, LoadingPlaceholder, RadioButtonGroup, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../../DynamicTable';
import { StateTag } from '../../StateTag';
import { parsePromQLStyleMatcherLooseSafe } from '../../../utils/matchers';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';

// Helper function to convert Matcher to API format
function matcherToAPIFormat(matcher: Matcher): { type: string; label: string; value: string } {
  let type: string;
  if (matcher.isEqual && !matcher.isRegex) {
    type = '=';
  } else if (!matcher.isEqual && !matcher.isRegex) {
    type = '!=';
  } else if (matcher.isEqual && matcher.isRegex) {
    type = '=~';
  } else {
    type = '!~';
  }

  return {
    type,
    label: matcher.name,
    value: matcher.value,
  };
}

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
  const styles = useStyles2(getStyles);
  const ruleUID = rule.grafana_alert.uid;

  const [labelFilter, setLabelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter | undefined>();
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter | undefined>();

  const [createNotificationQuery, { data, isLoading, isError, error }] = useCreateNotificationqueryMutation();

  // Fetch notifications when filters change
  useEffect(() => {
    // Convert to ISO string timestamps
    const fromDate = dateTime().subtract(30, 'days').toISOString();
    const toDate = dateTime().toISOString();

    // Convert label filter to API matchers
    let groupLabels: Array<{ type: string; label: string; value: string }> = [];
    if (labelFilter && labelFilter.trim()) {
      const matchers = parsePromQLStyleMatcherLooseSafe(labelFilter);
      groupLabels = matchers.map(matcherToAPIFormat);
    }

    createNotificationQuery({
      createNotificationqueryRequestBody: {
        ruleUID,
        from: fromDate,
        to: toDate,
        limit: 100,
        status: statusFilter,
        outcome: outcomeFilter,
        groupLabels,
      },
    });
  }, [createNotificationQuery, ruleUID, statusFilter, outcomeFilter, labelFilter]);

  // Extract entries from API response (data is properly typed from the generated client)
  const entriesArray: NotificationEntry[] = useMemo(() => {
    return data?.entries ?? [];
  }, [data]);

  // Prepare table items
  const items: NotificationTableItemProps[] = useMemo(
    () =>
      entriesArray.map((entry, index) => ({
        data: entry,
        id: `${entry.timestamp}-${index}`,
      })),
    [entriesArray]
  );

  // Define table columns
  const columns: NotificationTableColumnProps[] = useMemo(
    () => [
      {
        id: 'time',
        label: 'Time',
        renderCell: function TimeCell({ data }) {
          return <span>{data.timestamp ? dateTime(data.timestamp).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>;
        },
        size: '180px',
      },
      {
        id: 'state',
        label: 'State',
        renderCell: function StateCell({ data }) {
          const isFiring = data.status === 'firing';
          const statusText = isFiring ? 'Firing' : 'Resolved';
          const state = isFiring ? 'bad' : 'good';
          return <StateTag state={state}>{statusText}</StateTag>;
        },
        size: '100px',
      },
      {
        id: 'groupLabels',
        label: 'Group Labels',
        renderCell: function GroupLabelsCell({ data }) {
          const onLabelClick = ([value, label]: [string | undefined, string | undefined]) => {
            if (label && value) {
              setLabelFilter(`{${label}="${value}"}`);
            }
          };

          // Filter out alertname as it's redundant (already shown as the rule name)
          const filteredGroupLabels = data.groupLabels
            ? Object.keys(data.groupLabels).reduce((acc, key) => {
                if (key !== 'alertname') {
                  acc[key] = data.groupLabels[key];
                }
                return acc;
              }, {} as Record<string, string>)
            : {};

          if (!filteredGroupLabels || Object.keys(filteredGroupLabels).length === 0) {
            return <span>-</span>;
          }
          return (
            <div className={styles.labelsCell}>
              <AlertLabels labels={filteredGroupLabels} size="xs" onClick={onLabelClick} />
            </div>
          );
        },
      },
      {
        id: 'status',
        label: '',
        renderCell: function StatusCell({ data }) {
          return (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {data.outcome === 'error' && (
                <Badge color="orange" icon="exclamation-triangle" text="Failed" />
              )}
            </div>
          );
        },
        size: '100px',
      },
      {
        id: 'receiver',
        label: 'Contact point',
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
    content = <LoadingPlaceholder text="Loading notifications..." />;
  } else if (isError) {
    let errorMessage = 'Unable to fetch notification history';

    if (error) {
      if (typeof error === 'object' && error !== null && 'data' in error) {
        errorMessage = JSON.stringify((error as any).data);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
    }

    content = (
      <Alert title="Error fetching notifications" severity="error">
        {errorMessage}
      </Alert>
    );
  } else if (entriesArray.length === 0) {
    content = (
      <div className={styles.emptyState}>
        <Stack direction="column" gap={1} alignItems="center">
          <Text color="secondary">No notifications have been sent for this alert rule in the last 30 days</Text>
        </Stack>
      </div>
    );
  } else {
    content = (
      <div className={styles.tableWrapper}>
        <DynamicTable
        cols={columns}
        isExpandable={true}
        items={items}
        renderExpandedContent={({ data }) => {
          // Split alerts into firing and resolved
          const firingAlerts = data.alerts?.filter((alert: any) => alert.status === 'firing') || [];
          const resolvedAlerts = data.alerts?.filter((alert: any) => alert.status === 'resolved') || [];

          const renderAlert = (alert: any, index: number) => {
                  // Filter out labels that are already in groupLabels
                  // Also filter out grafana_folder as it's redundant and always the same for a single alert
                  const uniqueLabels = alert.labels
                    ? Object.keys(alert.labels).reduce((acc, key) => {
                        if (key !== 'grafana_folder' && (!data.groupLabels || !(key in data.groupLabels))) {
                          acc[key] = alert.labels[key];
                        }
                        return acc;
                      }, {} as Record<string, string>)
                    : {};
                  const hasUniqueLabels = Object.keys(uniqueLabels).length > 0;

                  // Extract summary and description annotations separately if they exist
                  const summary = alert.annotations?.summary;
                  const description = alert.annotations?.description;
                  const otherAnnotations = alert.annotations
                    ? Object.keys(alert.annotations).reduce((acc, key) => {
                        if (key !== 'summary' && key !== 'description') {
                          acc[key] = alert.annotations[key];
                        }
                        return acc;
                      }, {} as Record<string, string>)
                    : {};
                  const hasOtherAnnotations = Object.keys(otherAnnotations).length > 0;

                  return (
                    <div key={index} className={styles.alertDetail}>
                      <Stack direction="column" gap={1}>
                        {hasUniqueLabels && (
                          <Stack direction="row" gap={1} alignItems="center">
                            <Text variant="bodySmall" color="secondary">
                              <strong>Labels:</strong>
                            </Text>
                            <AlertLabels labels={uniqueLabels} size="sm" />
                          </Stack>
                        )}
                        {hasOtherAnnotations && (
                          <Stack direction="row" gap={1} alignItems="center">
                            <Text variant="bodySmall" color="secondary">
                              <strong>Annotations:</strong>
                            </Text>
                            <AlertLabels labels={otherAnnotations} size="sm" />
                          </Stack>
                        )}
                        {summary && (
                          <Text variant="bodySmall" color="secondary">
                            <strong>Summary:</strong> {summary}
                          </Text>
                        )}
                        {description && (
                          <Text variant="bodySmall" color="secondary">
                            <strong>Description:</strong> {description}
                          </Text>
                        )}
                        {alert.startsAt && (
                          <Text variant="bodySmall" color="secondary">
                            Started: {dateTime(alert.startsAt).format('YYYY-MM-DD HH:mm:ss')}
                          </Text>
                        )}
                      </Stack>
                    </div>
                  );
          };

          return (
            <div className={styles.expandedContent}>
              <Stack direction="column" gap={2}>
                {/* Error message if present */}
                {data.error && (
                  <Alert title="Notification Error" severity="warning">
                    {data.error}
                  </Alert>
                )}
                {/* Firing alerts section */}
                {firingAlerts.length > 0 && (
                  <Stack direction="column" gap={2}>
                    <Text variant="h6">Firing Alerts ({firingAlerts.length})</Text>
                    {firingAlerts.map(renderAlert)}
                  </Stack>
                )}
                {/* Resolved alerts section */}
                {resolvedAlerts.length > 0 && (
                  <Stack direction="column" gap={2}>
                    <Text variant="h6">Resolved Alerts ({resolvedAlerts.length})</Text>
                    {resolvedAlerts.map(renderAlert)}
                  </Stack>
                )}
              </Stack>
            </div>
          );
        }}
      />
      </div>
    );
  }

  return (
    <>
      <div className={styles.filtersWrapper}>
        <Stack direction="row" gap={2} alignItems="flex-end">
          <div className={styles.filterGroup}>
            <Label>
              <Stack gap={0.5} alignItems="center">
                <span>Filter notifications</span>
                <Tooltip
                  content={
                    <div>
                      Use label matcher expression or click on an group label to filter instances, for example:
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
              placeholder="Search labels..."
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.currentTarget.value)}
              width={30}
              prefix={<Icon name="search" />}
            />
          </div>
          <div className={styles.filterGroup}>
            <Label>Status</Label>
            <RadioButtonGroup
              options={[
                { label: 'Firing', value: 'firing' },
                { label: 'Resolved', value: 'resolved' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              onClick={(v) => {
                if (v === statusFilter) {
                  setStatusFilter(undefined);
                }
              }}
            />
          </div>
          <div className={styles.filterGroup}>
            <Label>Outcome</Label>
            <RadioButtonGroup
              options={[
                { label: 'Success', value: 'success' },
                { label: 'Failed', value: 'error' },
              ]}
              value={outcomeFilter}
              onChange={setOutcomeFilter}
              onClick={(v) => {
                if (v === outcomeFilter) {
                  setOutcomeFilter(undefined);
                }
              }}
            />
          </div>
        </Stack>
      </div>
      {content}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  emptyState: css({
    color: theme.colors.text.secondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
  }),
  filtersWrapper: css({
    marginBottom: theme.spacing(2),
  }),
  filterGroup: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    marginBottom: 0,
  }),
  tableWrapper: css({
    '& tr': {
      '& > td': {
        paddingTop: `${theme.spacing(1.5)} !important`,
        paddingBottom: `${theme.spacing(1.5)} !important`,
      },
    },
  }),
  labelsCell: css({
    fontSize: theme.typography.bodySmall.fontSize,
    '& *': {
      fontSize: `${theme.typography.bodySmall.fontSize} !important`,
    },
  }),
  expandedContent: css({
    padding: theme.spacing(2),
  }),
  alertDetail: css({
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
});

export { Notifications };
