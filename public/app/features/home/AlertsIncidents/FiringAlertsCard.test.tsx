import { http, HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertState, type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { FiringAlertsCard } from './FiringAlertsCard';
import { HOME_CARD_MAX_ITEMS } from './constants';

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
    labels: { alertname: 'test', severity: 'warning', ...overrides.labels },
  };
}

const criticalAlert = makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical', team: 'platform' } });
const highAlert = makeAlert({ labels: { alertname: 'Memory High', severity: 'high', team: 'platform' } });
const warningAlert = makeAlert({ labels: { alertname: 'Disk Warning', severity: 'warning', team: 'infra' } });
const critAliasAlert = makeAlert({ labels: { alertname: 'Crit Alias', severity: 'crit', team: 'platform' } });
const sev2Alert = makeAlert({ labels: { alertname: 'Sev2 Alert', severity: 'SEV2', team: 'platform' } });

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

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  // Grant alerting permission by default
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action: string) => action === AccessControlAction.AlertingInstanceRead);
  mockTeams([]);
  mockAlerts([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('FiringAlertsCard', () => {
  it('renders null when user lacks AlertingInstanceRead permission', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    const { container } = render(<FiringAlertsCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders alerts sorted by severity', async () => {
    mockTeams([]);
    mockAlerts([warningAlert, criticalAlert, highAlert]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();

    expect(screen.getByText('Memory High')).toBeInTheDocument();
    expect(screen.getByText('Disk Warning')).toBeInTheDocument();

    // Severity counts in header
    expect(screen.getByText(/1 critical/i)).toBeInTheDocument();
    expect(screen.getByText(/1 high/i)).toBeInTheDocument();
  });

  it('labels each severity dot with its level', async () => {
    mockTeams([]);
    mockAlerts([criticalAlert, highAlert]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();

    expect(screen.getByRole('img', { name: 'Critical' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'High' })).toBeInTheDocument();
  });

  it('counts non-canonical severity aliases by canonical level', async () => {
    mockTeams([]);
    mockAlerts([critAliasAlert, sev2Alert]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('Crit Alias')).toBeInTheDocument();

    // 'crit' canonicalizes to critical, 'SEV2' to major (shown as the "high" badge)
    expect(screen.getByText(/1 critical/i)).toBeInTheDocument();
    expect(screen.getByText(/1 high/i)).toBeInTheDocument();
  });

  it('renders an alert with no severity label without crashing', async () => {
    const noSeverityAlert = makeAlert({ labels: { alertname: 'No Severity', team: 'platform' } });
    mockTeams([]);
    mockAlerts([noSeverityAlert]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('No Severity')).toBeInTheDocument();

    // Missing severity must not crash canonicalSeverity and must not be counted in either badge
    expect(screen.queryByText(/\d+ critical/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ high/i)).not.toBeInTheDocument();
  });

  it('builds team matchers when user has teams', async () => {
    const capturedRequests: Request[] = [];
    mockTeams([{ name: 'platform' }, { name: 'infra' }]);

    server.use(
      http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
        capturedRequests.push(request);
        return HttpResponse.json([criticalAlert]);
      })
    );

    render(<FiringAlertsCard />);

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();

    // Verify that the request included a team filter matcher
    const lastReq = capturedRequests[capturedRequests.length - 1];
    const url = new URL(lastReq.url);
    const filters = url.searchParams.getAll('filter');
    expect(filters.some((f) => f.includes('team') && f.includes('platform|infra'))).toBe(true);
  });

  it('escapes regex metacharacters in team names', async () => {
    const capturedRequests: Request[] = [];
    mockTeams([{ name: 'team.one' }]);

    server.use(
      http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
        capturedRequests.push(request);
        return HttpResponse.json([criticalAlert]);
      })
    );

    render(<FiringAlertsCard />);

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();

    // buildTeamMatchers escapes the '.' to '\.', then quoteWithEscape doubles the backslash on the wire
    const lastReq = capturedRequests[capturedRequests.length - 1];
    const filters = new URL(lastReq.url).searchParams.getAll('filter');
    expect(filters.some((f) => f.includes('team\\\\.one'))).toBe(true);
  });

  it('shows team-scoped empty state when team-filtered result is empty', async () => {
    mockTeams([{ name: 'empty-team' }]);
    mockAlerts([]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('No firing alerts for your teams.')).toBeInTheDocument();

    expect(screen.queryByText('Show all firing alerts')).not.toBeInTheDocument();
  });

  it('shows generic empty state when user has no teams', async () => {
    mockTeams([]);
    mockAlerts([]);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('You have no firing alerts.')).toBeInTheDocument();
  });

  it('caps the rendered list at HOME_CARD_MAX_ITEMS while badges count every alert', async () => {
    mockTeams([]);
    const many = Array.from({ length: HOME_CARD_MAX_ITEMS + 1 }, (_, i) =>
      makeAlert({ labels: { alertname: `Alert ${i}`, severity: 'critical', team: 'platform' } })
    );
    mockAlerts(many);

    render(<FiringAlertsCard />);

    expect(await screen.findByText('Alert 0')).toBeInTheDocument();
    // Render is capped even though one more alert is firing...
    expect(screen.getAllByRole('listitem')).toHaveLength(HOME_CARD_MAX_ITEMS);
    // ...but the severity badge still counts every alert.
    expect(screen.getByText(new RegExp(`${HOME_CARD_MAX_ITEMS + 1} critical`, 'i'))).toBeInTheDocument();
  });
});
