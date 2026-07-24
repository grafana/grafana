import { http, HttpResponse } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { PluginIncludeType, type PluginMeta } from '@grafana/data';
import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { invalidateCachedPromisesCache } from '@grafana/runtime/internal';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { ACTIVE_INCIDENTS_QUERY_LIMIT, type IncidentPreview } from 'app/features/alerting/unified/api/incidentsApi';
import { pluginMeta } from 'app/features/alerting/unified/testSetup/plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { AlertState, type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { AlertIncidentTabs } from './AlertIncidentTabs';

jest.mock('../analytics/main', () => ({
  ctaClicked: jest.fn(),
  tabChanged: jest.fn(),
  clearHistoryClicked: jest.fn(),
  homepageViewed: jest.fn(),
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

/** Report the Incident/IRM plugins as absent so the component only shows the alerts tab. */
function mockNoIncidentPlugin() {
  server.use(http.get('/api/plugins/:pluginId/settings', () => HttpResponse.json({ enabled: false })));
}

/** Install the Incident plugin (IRM stays absent) with optional page includes for access gating. */
function mockIncidentPlugin(settings?: Partial<PluginMeta>) {
  server.use(
    http.get(`/api/plugins/${SupportedPlugin.Incident}/settings`, () =>
      HttpResponse.json({ ...pluginMeta[SupportedPlugin.Incident], includes: [], ...settings })
    )
  );
}

function mockIncidents(incidents: IncidentPreview[], { hasMore = false } = {}) {
  server.use(
    http.post('/api/plugins/:pluginId/resources/api/v1/IncidentsService.QueryIncidentPreviews', () =>
      HttpResponse.json({ incidentPreviews: incidents, cursor: { hasMore, nextValue: hasMore ? 'next' : '' } })
    )
  );
}

const activeIncident: IncidentPreview = {
  incidentID: '101',
  title: 'Database outage',
  severityLabel: 'Critical',
  createdTime: '2024-01-02T10:00:00Z',
};

beforeEach(async () => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  // Grant alerting permission by default
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action: string) => action === AccessControlAction.AlertingInstanceRead);
  mockTeams([]);
  mockAlerts([]);
  // The component probes the IRM/Incident plugin settings; absent by default.
  // Tests that need the incidents tab layer mockIncidentPlugin() on top.
  mockNoIncidentPlugin();
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
  // getPluginSettings memoizes per plugin ID at module scope; clear it so each
  // test's plugin-settings handler actually gets hit.
  invalidateCachedPromisesCache();
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

  it("shows '50+' on the Incidents tab counter when the server reports more incidents beyond the query limit", async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockIncidentPlugin();
    const fullPage: IncidentPreview[] = Array.from({ length: ACTIVE_INCIDENTS_QUERY_LIMIT }, (_, i) => ({
      incidentID: String(i),
      title: `Incident ${i}`,
      severityLabel: 'Critical',
      createdTime: '2024-01-02T10:00:00Z',
    }));
    mockIncidents(fullPage, { hasMore: true });

    render(<AlertIncidentTabs />);

    const tab = await screen.findByRole('tab', { name: /incidents/i });
    await waitFor(() => expect(tab).toHaveTextContent(`${ACTIVE_INCIDENTS_QUERY_LIMIT}+`));
  });

  it('shows the exact count on the Incidents tab counter when a full page has nothing beyond it', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockIncidentPlugin();
    const fullPage: IncidentPreview[] = Array.from({ length: ACTIVE_INCIDENTS_QUERY_LIMIT }, (_, i) => ({
      incidentID: String(i),
      title: `Incident ${i}`,
      severityLabel: 'Critical',
      createdTime: '2024-01-02T10:00:00Z',
    }));
    mockIncidents(fullPage, { hasMore: false });

    render(<AlertIncidentTabs />);

    const tab = await screen.findByRole('tab', { name: /incidents/i });
    await waitFor(() => expect(tab).toHaveTextContent(String(ACTIVE_INCIDENTS_QUERY_LIMIT)));
    expect(tab).not.toHaveTextContent(`${ACTIVE_INCIDENTS_QUERY_LIMIT}+`);
  });

  it('defaults to the Incidents tab for a user without alerting permission when the plugin is installed', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockIncidentPlugin();
    mockIncidents([activeIncident]);

    render(<AlertIncidentTabs />);

    expect(await screen.findByText('Database outage')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /incidents/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: /firing alerts/i })).not.toBeInTheDocument();
  });

  it('switches to the Incidents tab and renders incident content', async () => {
    mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);
    mockIncidentPlugin();
    mockIncidents([activeIncident]);

    const { user } = render(<AlertIncidentTabs />);

    // Alerts tab is active by default.
    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();

    await user.click(await screen.findByRole('tab', { name: /incidents/i }));

    expect(await screen.findByText('Database outage')).toBeInTheDocument();
    expect(screen.queryByText('CPU Critical')).not.toBeInTheDocument();
  });

  it('shows the incidents footer actions when the user can declare and access incidents', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    // No page includes to gate on, so canDeclare/canAccess both resolve to true.
    mockIncidentPlugin({ includes: [] });
    mockIncidents([activeIncident]);

    render(<AlertIncidentTabs />);

    expect(await screen.findByText('Database outage')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /declare an incident/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view all incidents/i })).toBeInTheDocument();
  });

  it('hides the incidents footer actions when the user lacks the plugin page permissions', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockIncidentPlugin({
      includes: [
        {
          type: PluginIncludeType.page,
          name: 'Incidents',
          path: '/a/grafana-incident-app/incidents',
          action: 'grafana-incident-app.incidents:read',
        },
        {
          type: PluginIncludeType.page,
          name: 'Declare incident',
          path: '/a/grafana-incident-app/incidents/declare',
          action: 'grafana-incident-app.incidents:write',
        },
      ],
    });
    mockIncidents([activeIncident]);

    render(<AlertIncidentTabs />);

    expect(await screen.findByText('Database outage')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /declare an incident/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view all incidents/i })).not.toBeInTheDocument();
  });
});
