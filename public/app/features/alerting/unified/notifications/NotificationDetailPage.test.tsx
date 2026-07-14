import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render } from 'test/test-utils';

import { type CreateNotificationqueryNotificationEntry } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';

import { setupMswServer } from '../mockApi';
import { HISTORIAN_BASE, setHistorianAlerts, setHistorianNotifications } from '../mocks/server/handlers/historian';

import NotificationDetailPage from './NotificationDetailPage';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

const server = setupMswServer();

let notificationCounter = 0;

function makeNotification(overrides: Partial<NotificationEntry> = {}): NotificationEntry {
  const id = ++notificationCounter;
  return {
    uuid: `uuid-${id}`,
    ruleUIDs: ['rule-1'],
    receiver: 'slack-receiver',
    integration: 'slack',
    integrationIndex: 0,
    status: 'firing',
    outcome: 'success',
    duration: 150_000_000,
    alertCount: 2,
    alerts: [],
    groupKey: 'group-key-1',
    groupLabels: { alertname: 'HighCPU' },
    pipelineTime: '2026-03-08T12:00:00Z',
    retry: false,
    timestamp: '2026-03-08T12:00:01Z',
    error: undefined,
    ...overrides,
  };
}

function renderPage(uuid: string, timestamp?: string) {
  const path = timestamp
    ? `/alerting/notifications-history/view/${uuid}?ts=${new Date(timestamp).getTime()}`
    : `/alerting/notifications-history/view/${uuid}`;

  return render(
    <Routes>
      <Route path="/alerting/notifications-history/view/:uuid" element={<NotificationDetailPage />} />
    </Routes>,
    { historyOptions: { initialEntries: [path] } }
  );
}

beforeEach(() => {
  notificationCounter = 0;
});

describe('NotificationDetailPage', () => {
  it('shows loading state initially', async () => {
    const notification = makeNotification();
    setHistorianNotifications([notification]);

    renderPage(notification.uuid, notification.timestamp);

    expect(screen.getByText(/loading notification/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText(/loading notification/i)).not.toBeInTheDocument());
  });

  it('renders notification details on success', async () => {
    const notification = makeNotification({
      receiver: 'my-slack',
      integration: 'slack',
      status: 'firing',
      outcome: 'success',
      alertCount: 3,
    });
    setHistorianNotifications([notification]);

    renderPage(notification.uuid, notification.timestamp);

    expect(await screen.findByText('Delivered successfully')).toBeInTheDocument();
    expect(screen.getByText('my-slack')).toBeInTheDocument();
    expect(screen.getByText(/3 alert/)).toBeInTheDocument();
  });

  it('renders error state when API fails', async () => {
    server.use(http.post(`${HISTORIAN_BASE}/notification/query`, () => HttpResponse.json({}, { status: 500 })));

    renderPage('uuid-missing', '2026-03-08T12:00:00Z');

    expect(await screen.findByText(/error loading notification/i)).toBeInTheDocument();
  });

  it('shows not-found when UUID does not match any entry', async () => {
    const notification = makeNotification({ uuid: 'uuid-other' });
    setHistorianNotifications([notification]);

    renderPage('uuid-does-not-exist', notification.timestamp);

    expect(await screen.findByText(/notification not found/i)).toBeInTheDocument();
  });

  it('shows delivery error banner when notification has error', async () => {
    const notification = makeNotification({
      outcome: 'error',
      error: 'connection refused to smtp server',
    });
    setHistorianNotifications([notification]);

    renderPage(notification.uuid, notification.timestamp);

    expect(await screen.findByText('Delivery failed')).toBeInTheDocument();
    expect(screen.getByText('connection refused to smtp server')).toBeInTheDocument();
  });

  it('shows retry icon when notification is a retry', async () => {
    const notification = makeNotification({ retry: true });
    setHistorianNotifications([notification]);

    renderPage(notification.uuid, notification.timestamp);

    await screen.findByText('Delivered successfully');

    expect(screen.getByText('This was a retry of a previous attempt')).toBeInTheDocument();
  });

  it('renders firing and resolved alerts on alerts tab', async () => {
    const user = userEvent.setup();
    const notification = makeNotification();
    setHistorianNotifications([notification]);
    setHistorianAlerts([
      {
        labels: { alertname: 'HighCPU', __alert_rule_uid__: 'rule-1' },
        annotations: { summary: 'CPU is above 90%' },
        status: 'firing',
        startsAt: '2026-03-08T11:55:00Z',
        endsAt: '0001-01-01T00:00:00Z',
      },
      {
        labels: { alertname: 'DiskFull', __alert_rule_uid__: 'rule-2' },
        annotations: {},
        status: 'resolved',
        startsAt: '2026-03-08T10:00:00Z',
        endsAt: '2026-03-08T11:00:00Z',
      },
    ]);

    renderPage(notification.uuid, notification.timestamp);

    // Wait for data to load, then switch to Alerts tab
    await screen.findByText('Delivered successfully');
    await user.click(screen.getByRole('tab', { name: /alerts/i }));

    expect(await screen.findByText('CPU is above 90%')).toBeInTheDocument();
    expect(screen.getAllByText('Firing').length).toBeGreaterThanOrEqual(2); // header + alert badge
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('shows group labels in page info when present', async () => {
    const notification = makeNotification({
      groupLabels: { alertname: 'HighCPU', severity: 'critical' },
    });
    setHistorianNotifications([notification]);

    renderPage(notification.uuid, notification.timestamp);

    // Wait for notification data to load
    await screen.findByText('Delivered successfully');
    // Labels are rendered in the page info area via AlertLabels
    const labelElements = await screen.findAllByTestId('label-value');
    expect(labelElements.length).toBe(2);
    expect(screen.getByLabelText('alertname: HighCPU')).toBeInTheDocument();
    expect(screen.getByLabelText('severity: critical')).toBeInTheDocument();
  });

  it('renders more details section collapsed by default', async () => {
    const notification = makeNotification();
    setHistorianNotifications([notification]);

    renderPage(notification.uuid, notification.timestamp);

    await screen.findByText('Delivered successfully');

    expect(screen.getByText(/more details/i)).toBeInTheDocument();
    expect(screen.queryByText(notification.uuid)).not.toBeInTheDocument();
  });

  it('expands more details on click and shows UUID', async () => {
    const user = userEvent.setup();
    const notification = makeNotification();
    setHistorianNotifications([notification]);

    renderPage(notification.uuid, notification.timestamp);

    await screen.findByText('Delivered successfully');

    await user.click(screen.getByText(/more details/i));

    expect(await screen.findByText(notification.uuid)).toBeInTheDocument();
  });

  it('shows related notifications in tab', async () => {
    const user = userEvent.setup();
    const notification = makeNotification();
    const relatedNotification = makeNotification({
      uuid: 'uuid-related',
      groupKey: notification.groupKey,
      integration: 'email',
      receiver: 'email-receiver',
    });

    setHistorianNotifications([notification, relatedNotification]);

    renderPage(notification.uuid, notification.timestamp);

    await screen.findByText('Delivered successfully');

    const relatedTab = screen.getByRole('tab', { name: /related/i });
    await user.click(relatedTab);

    expect(await screen.findByText('email-receiver')).toBeInTheDocument();
  });

  it('shows actions menu with quick action links', async () => {
    const user = userEvent.setup();
    const notification = makeNotification({
      receiver: 'my-slack',
      groupLabels: { alertname: 'HighCPU' },
    });
    setHistorianNotifications([notification]);

    renderPage(notification.uuid, notification.timestamp);

    // Wait for the notification to load
    await screen.findByText('Delivered successfully');
    // Open the actions menu (there may be multiple "More" buttons rendered by the Page header)
    const moreButtons = await screen.findAllByRole('button', { name: /more/i });
    const moreButton = moreButtons[0];
    await user.click(moreButton);

    expect(screen.getByRole('menuitem', { name: /view contact point/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /view alert rule/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /silence notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /copy link/i })).toBeInTheDocument();
  });
});
