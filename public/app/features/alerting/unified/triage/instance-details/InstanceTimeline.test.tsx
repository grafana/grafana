import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CreateNotificationqueryNotificationEntry } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { GrafanaAlertStateWithReason } from 'app/types/unified-alerting-dto';

import { LogRecord } from '../../components/rules/state-history/common';

import { InstanceTimeline, buildTimelineEntries, buildTimelineGroups } from './InstanceTimeline';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

let notificationCounter = 0;

function makeRecord(
  timestamp: number,
  previous: GrafanaAlertStateWithReason,
  current: GrafanaAlertStateWithReason
): LogRecord {
  return {
    timestamp,
    line: {
      previous,
      current,
    },
  };
}

function makeNotification(overrides: Partial<NotificationEntry> & { timestamp: string }): NotificationEntry {
  return {
    uuid: `notif-${++notificationCounter}`,
    ruleUIDs: ['rule-1'],
    receiver: 'email-receiver',
    integration: 'email',
    integrationIndex: 0,
    status: 'firing',
    outcome: 'success',
    duration: 50_000_000,
    alertCount: 1,
    alerts: [],
    groupKey: 'group-1',
    groupLabels: {},
    pipelineTime: '1970-01-01T00:00:00Z',
    retry: false,
    ...overrides,
  };
}

describe('buildTimelineGroups', () => {
  it('returns empty array when no records and no notifications', () => {
    expect(buildTimelineGroups([], [])).toEqual([]);
  });

  it('returns state-change groups when there are only records', () => {
    const records = [makeRecord(1000, 'Normal', 'Alerting'), makeRecord(2000, 'Alerting', 'Normal')];

    const groups = buildTimelineGroups(records, []);

    expect(groups).toHaveLength(2);
    expect(groups[0].type).toBe('state-change');
    expect(groups[0].timestamp).toBe(2000);
    expect(groups[0].notifications).toEqual([]);
    expect(groups[1].type).toBe('state-change');
    expect(groups[1].timestamp).toBe(1000);
  });

  it('assigns notifications to the most recent preceding state change', () => {
    const records = [makeRecord(1000, 'Normal', 'Alerting'), makeRecord(3000, 'Alerting', 'Normal')];

    const notifications = [
      makeNotification({ timestamp: '1970-01-01T00:00:01.500Z' }), // 1500ms -> belongs to record at 1000
      makeNotification({ timestamp: '1970-01-01T00:00:03.500Z' }), // 3500ms -> belongs to record at 3000
    ];

    const groups = buildTimelineGroups(records, notifications);

    expect(groups).toHaveLength(2);
    // groups are reversed (newest first)
    expect(groups[0].timestamp).toBe(3000);
    expect(groups[0].notifications).toHaveLength(1);
    expect(groups[1].timestamp).toBe(1000);
    expect(groups[1].notifications).toHaveLength(1);
  });

  it('collects notifications before all state changes as orphans', () => {
    const records = [makeRecord(5000, 'Normal', 'Alerting')];

    const notifications = [
      makeNotification({ timestamp: '1970-01-01T00:00:01.000Z' }), // 1000ms -> before record at 5000
      makeNotification({ timestamp: '1970-01-01T00:00:02.000Z' }), // 2000ms -> before record at 5000
    ];

    const groups = buildTimelineGroups(records, notifications);

    expect(groups).toHaveLength(2);
    expect(groups[0].type).toBe('state-change');
    expect(groups[0].notifications).toHaveLength(0);
    expect(groups[1].type).toBe('orphan-notifications');
    expect(groups[1].notifications).toHaveLength(2);
  });

  it('creates orphan group when there are only notifications (no records)', () => {
    const notifications = [
      makeNotification({ timestamp: '2026-03-04T10:00:00Z' }),
      makeNotification({ timestamp: '2026-03-04T10:01:00Z' }),
    ];

    const groups = buildTimelineGroups([], notifications);

    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('orphan-notifications');
    expect(groups[0].notifications).toHaveLength(2);
  });

  it('assigns multiple notifications to the same state change', () => {
    const records = [makeRecord(1000, 'Normal', 'Alerting')];

    const notifications = [
      makeNotification({ timestamp: '1970-01-01T00:00:01.100Z', receiver: 'email' }),
      makeNotification({ timestamp: '1970-01-01T00:00:01.200Z', receiver: 'slack' }),
      makeNotification({ timestamp: '1970-01-01T00:00:01.300Z', receiver: 'pagerduty' }),
    ];

    const groups = buildTimelineGroups(records, notifications);

    expect(groups).toHaveLength(1);
    expect(groups[0].notifications).toHaveLength(3);
  });
});

describe('buildTimelineEntries', () => {
  it('returns empty array for empty groups', () => {
    expect(buildTimelineEntries([])).toEqual([]);
  });

  it('creates state-change entries for groups without notifications', () => {
    const groups = buildTimelineGroups([makeRecord(1000, 'Normal', 'Alerting')], []);

    const entries = buildTimelineEntries(groups);

    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('state-change');
    expect(entries[0].previous).toBe('Normal');
    expect(entries[0].current).toBe('Alerting');
  });

  it('creates both notification and state-change entries for groups with notifications', () => {
    const records = [makeRecord(1000, 'Normal', 'Alerting')];
    const notifications = [makeNotification({ timestamp: '1970-01-01T00:00:01.500Z' })];

    const groups = buildTimelineGroups(records, notifications);
    const entries = buildTimelineEntries(groups);

    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('notifications');
    expect(entries[0].notifications).toHaveLength(1);
    expect(entries[1].type).toBe('state-change');
  });

  it('uses the last notification timestamp for the notifications entry', () => {
    const records = [makeRecord(1000, 'Normal', 'Alerting')];
    const notifications = [
      makeNotification({ timestamp: '1970-01-01T00:00:01.100Z' }),
      makeNotification({ timestamp: '1970-01-01T00:00:01.500Z' }),
    ];

    const groups = buildTimelineGroups(records, notifications);
    const entries = buildTimelineEntries(groups);

    const notifEntry = entries.find((e) => e.type === 'notifications')!;
    expect(notifEntry.timestamp).toBe(1500);
  });

  it('does not create entries for orphan groups (no state change)', () => {
    const notifications = [makeNotification({ timestamp: '1970-01-01T00:00:01.000Z' })];

    const groups = buildTimelineGroups([], notifications);
    const entries = buildTimelineEntries(groups);

    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('notifications');
  });
});

describe('InstanceTimeline component', () => {
  it('shows empty message when there are no records or notifications', () => {
    render(<InstanceTimeline records={[]} notifications={[]} />);
    expect(screen.getByText('No events found for this time range')).toBeInTheDocument();
  });

  it('renders state changes', () => {
    const records = [makeRecord(1000, 'Normal', 'Alerting')];

    render(<InstanceTimeline records={records} notifications={[]} />);

    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('Alerting')).toBeInTheDocument();
  });

  it('filters to show only notifications when filter is selected', async () => {
    const user = userEvent.setup();
    const records = [makeRecord(1000, 'Normal', 'Alerting')];
    const notifications = [makeNotification({ timestamp: '1970-01-01T00:00:01.500Z' })];

    render(<InstanceTimeline records={records} notifications={notifications} />);

    await user.click(screen.getByRole('radio', { name: 'Notifications' }));

    expect(screen.queryByText('Normal')).not.toBeInTheDocument();
    expect(screen.getByText('1 notification')).toBeInTheDocument();
  });

  it('filters to show only state changes when filter is selected', async () => {
    const user = userEvent.setup();
    const records = [makeRecord(1000, 'Normal', 'Alerting')];
    const notifications = [makeNotification({ timestamp: '1970-01-01T00:00:01.500Z' })];

    render(<InstanceTimeline records={records} notifications={notifications} />);

    await user.click(screen.getByRole('radio', { name: 'State changes' }));

    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.queryByText('1 notification')).not.toBeInTheDocument();
  });

  it('shows empty filter message when no entries match the selected filter', async () => {
    const user = userEvent.setup();
    const records = [makeRecord(1000, 'Normal', 'Alerting')];

    render(<InstanceTimeline records={records} notifications={[]} />);

    await user.click(screen.getByRole('radio', { name: 'Notifications' }));

    expect(screen.getByText('No matching events for this filter')).toBeInTheDocument();
  });

  it('renders notification summary with receiver info', () => {
    const records = [makeRecord(1000, 'Normal', 'Alerting')];
    const notifications = [
      makeNotification({
        timestamp: '1970-01-01T00:00:01.500Z',
        receiver: 'my-slack-receiver',
        integration: 'slack',
        outcome: 'success',
      }),
    ];

    render(<InstanceTimeline records={records} notifications={notifications} />);

    expect(screen.getByText('1 notification')).toBeInTheDocument();
    expect(screen.getAllByText('my-slack-receiver').length).toBeGreaterThanOrEqual(1);
  });

  it('does not show outcome label when all notifications succeed', () => {
    const records = [makeRecord(1000, 'Normal', 'Alerting')];
    const notifications = [
      makeNotification({ timestamp: '1970-01-01T00:00:01.500Z', outcome: 'success' }),
      makeNotification({ timestamp: '1970-01-01T00:00:01.600Z', outcome: 'success' }),
    ];

    render(<InstanceTimeline records={records} notifications={notifications} />);

    expect(screen.queryByText(/^Delivered$/)).not.toBeInTheDocument();
  });

  it('shows outcome label when there are failed notifications', () => {
    const records = [makeRecord(1000, 'Normal', 'Alerting')];
    const notifications = [
      makeNotification({
        timestamp: '1970-01-01T00:00:01.500Z',
        outcome: 'success',
        integration: 'slack',
        integrationIndex: 0,
      }),
      makeNotification({
        timestamp: '1970-01-01T00:00:01.600Z',
        outcome: 'error',
        integration: 'webhook',
        integrationIndex: 1,
      }),
    ];

    render(<InstanceTimeline records={records} notifications={notifications} />);

    expect(screen.getByText('(Webhook #2 failed)')).toBeInTheDocument();
  });

  it('expands notification details when clicking on the summary row', async () => {
    const user = userEvent.setup();
    const records = [makeRecord(1000, 'Normal', 'Alerting')];
    const notifications = [
      makeNotification({
        timestamp: '1970-01-01T00:00:01.500Z',
        receiver: 'email-receiver',
        integration: 'email',
        outcome: 'success',
      }),
    ];

    render(<InstanceTimeline records={records} notifications={notifications} />);

    const summaryButton = screen.getByRole('button', { name: /toggle notification details/i });
    await user.click(summaryButton);

    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });
});
