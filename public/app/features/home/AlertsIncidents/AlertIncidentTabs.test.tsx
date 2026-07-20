import { http, HttpResponse } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertState, type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { AlertIncidentTabs } from './AlertIncidentTabs';

jest.mock('../analytics/main', () => ({
  alertsCardClicked: jest.fn(),
  incidentsCardClicked: jest.fn(),
  tabChanged: jest.fn(),
  clearHistoryClicked: jest.fn(),
  emptyCtaClicked: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();

function makeAlert(overrides: Partial<AlertmanagerAlert> & { labels: AlertmanagerAlert['labels'] }): AlertmanagerAlert {
  return {
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    updatedAt: new Date().toISOString(),
    endsAt: '0001-01-01T00:00:00Z',
    fingerprint: Math.random().toString(36).slice(2),
    receivers: [{ name: 'default' }],
    status: { state: AlertState.Active, silencedBy: [], inhibitedBy: [] },
    annotations: {},
    ...overrides,
    labels: { alertname: 'test', ...overrides.labels },
  };
}

function mockTeams(teams: Array<{ name: string }>) {
  server.use(
    http.get('/api/user/teams', () =>
      HttpResponse.json(
        teams.map((t, i) => ({ ...t, id: i + 1, uid: `team-${i}`, orgId: 1, memberCount: 1, isProvisioned: false }))
      )
    )
  );
}

function mockAlerts(alerts: AlertmanagerAlert[]) {
  server.use(http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () => HttpResponse.json(alerts)));
}

beforeEach(async () => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  // Grant alerting permission by default
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action: string) => action === AccessControlAction.AlertingInstanceRead);
  mockTeams([]);
  mockAlerts([]);
  // AlertIncidentTabs only ships in the growth-homepage redesign, which is flag-gated,
  // so exercise it in the same flag state it renders in production.
  await act(async () => {
    setTestFlags({ 'grafana.growthHomepage': true });
  });
});

afterEach(async () => {
  // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state updates.
  await act(async () => {
    setTestFlags({});
  });
  jest.restoreAllMocks();
});

describe('AlertIncidentTabs', () => {
  it('renders nothing when the user lacks AlertingInstanceRead permission', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    const { container } = render(<AlertIncidentTabs />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single Firing alerts heading and tab when permitted', async () => {
    mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

    render(<AlertIncidentTabs />);

    // Wait for the alert to load so the card content is rendered.
    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
    // In the redesign the inner card header is hidden, so only the section heading remains.
    expect(screen.getByRole('heading', { name: 'Alerts & incidents' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /firing alerts/i })).toBeInTheDocument();
    // The severity breakdown badge lives in the card header, which the redesign hides.
    expect(screen.queryByText(/1 critical/i)).not.toBeInTheDocument();
  });

  it('shows a tab counter reflecting the number of firing alerts', async () => {
    mockAlerts([
      makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } }),
      makeAlert({ labels: { alertname: 'Memory High', severity: 'high' } }),
    ]);

    render(<AlertIncidentTabs />);

    // Counter is undefined while loading, so wait until it reflects the loaded count.
    const tab = await screen.findByRole('tab', { name: /firing alerts/i });
    await waitFor(() => expect(tab).toHaveTextContent('2'));
  });
});
