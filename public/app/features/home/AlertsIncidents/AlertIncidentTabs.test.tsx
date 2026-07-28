import { http, HttpResponse } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { PluginIncludeType, type PluginMeta } from '@grafana/data';
import { config, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { invalidateCachedPromisesCache } from '@grafana/runtime/internal';
import { mockComboboxRect } from '@grafana/test-utils';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { ACTIVE_INCIDENTS_QUERY_LIMIT, type IncidentPreview } from 'app/features/alerting/unified/api/incidentsApi';
import { pluginMeta } from 'app/features/alerting/unified/testSetup/plugins';
import { fetchTagValues } from 'app/features/alerting/unified/triage/scene/tagKeysProviders';
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

// The team dropdown loads its options from the `team` label values on alerts,
// via the triage fetchTagValues helper; mock it rather than the datasource layer.
jest.mock('app/features/alerting/unified/triage/scene/tagKeysProviders', () => ({
  ...jest.requireActual('app/features/alerting/unified/triage/scene/tagKeysProviders'),
  fetchTagValues: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();
// The team filter Combobox virtualizes its options; without mocked element rects
// the virtualizer measures 0 height in jsdom and renders no options.
mockComboboxRect();

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

/** `team` label values the dropdown fetches from the state-history Prometheus datasource. */
function mockTeamLabelValues(values: string[]) {
  jest.mocked(fetchTagValues).mockResolvedValue(values.map((value) => ({ text: value, value })));
}

/** Mocks the alertmanager alerts endpoint; returns the `filter` query params of each request received. */
function mockAlerts(alerts: AlertmanagerAlert[]) {
  const requests: string[][] = [];
  server.use(
    http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
      requests.push(new URL(request.url).searchParams.getAll('filter'));
      return HttpResponse.json(alerts);
    })
  );
  return requests;
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

/**
 * Wire form of useFiringAlerts' tolerant own-teams pattern for one team name:
 * its letter/digit runs joined by separator gaps. quoteWithEscape doubles the
 * pattern's backslashes when the matcher is serialized into the filter param.
 */
function wireTolerantPattern(...runs: string[]) {
  const sep = '[^\\\\p{L}\\\\p{N}]*';
  return sep + runs.join(sep) + sep;
}

const activeIncident: IncidentPreview = {
  incidentID: '101',
  title: 'Database outage',
  severityLabel: 'Critical',
  createdTime: '2024-01-02T10:00:00Z',
};

const originalStateHistory = config.unifiedAlerting.stateHistory;

beforeEach(async () => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  // Grant alerting permission by default
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action: string) => action === AccessControlAction.AlertingInstanceRead);
  // The team dropdown only renders when the state-history Prometheus datasource is configured.
  config.unifiedAlerting.stateHistory = {
    ...originalStateHistory,
    prometheusTargetDatasourceUID: 'state-history-ds',
  };
  mockTeams([]);
  mockTeamLabelValues([]);
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
  config.unifiedAlerting.stateHistory = originalStateHistory;
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
    // The Incident plugin is absent here, so the heading drops the "& incidents" half.
    expect(screen.getByRole('heading', { name: 'Alerts' })).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'Incidents' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /firing alerts/i })).not.toBeInTheDocument();
  });

  it('switches to the Incidents tab and renders incident content', async () => {
    mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);
    mockIncidentPlugin();
    mockIncidents([activeIncident]);

    const { user } = render(<AlertIncidentTabs />);

    // Alerts tab is active by default.
    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Alerts & incidents' })).toBeInTheDocument();

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

  describe('team filter dropdown', () => {
    it('shows the dropdown on the Alerts tab and hides it on the Incidents tab', async () => {
      mockTeamLabelValues(['Team A']);
      mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);
      mockIncidentPlugin();
      mockIncidents([activeIncident]);

      const { user } = render(<AlertIncidentTabs />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      expect(await screen.findByRole('combobox', { name: /filter alerts by team/i })).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: /incidents/i }));

      expect(await screen.findByText('Database outage')).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /filter alerts by team/i })).not.toBeInTheDocument();
    });

    it('refetches alerts filtered to only the selected team', async () => {
      mockTeams([{ name: 'Team A' }, { name: 'Team B' }]);
      mockTeamLabelValues(['Team A', 'Team B', 'Team C']);
      const requests = mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      const { user } = render(<AlertIncidentTabs />);

      // Initial request is filtered to the user's own teams, matched tolerantly
      // ((?i) + separator gaps) since the free-form `team` label usually carries
      // some slugged or re-cased variant of the team name.
      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      expect(requests).toHaveLength(1);
      expect(requests[0]).toEqual([
        `team=~"(?i)${wireTolerantPattern('Team', 'A')}|${wireTolerantPattern('Team', 'B')}"`,
      ]);

      await user.click(await screen.findByRole('combobox', { name: /filter alerts by team/i }));
      // This user belongs to teams, so the default option describes that scope and
      // an explicit "All teams" escape hatch follows it, ahead of the teams.
      const options = await screen.findAllByRole('option');
      expect(options[0]).toHaveTextContent('Your teams');
      expect(options[1]).toHaveTextContent('All teams');
      expect(options[2]).toHaveTextContent('Team A');
      await user.click(await screen.findByRole('option', { name: 'Team C' }));

      // Selecting a team issues a new request whose matcher contains only that team.
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]).toEqual(['team=~"Team C"']);
    });

    it("restores the user's own-teams scope when selecting the 'Your teams' option", async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      // The user's own teams have a firing alert; the explicitly selected team has none.
      server.use(
        http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
          const filters = new URL(request.url).searchParams.getAll('filter');
          const isSelectedTeamFilter = filters.some((f) => f.includes('Team C'));
          return HttpResponse.json(
            isSelectedTeamFilter ? [] : [makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]
          );
        })
      );

      const { user } = render(<AlertIncidentTabs />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      const combobox = await screen.findByRole('combobox', { name: /filter alerts by team/i });

      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'Team C' }));
      expect(await screen.findByText('No firing alerts for Team C.')).toBeInTheDocument();

      // Picking "Your teams" clears the explicit selection and brings back the default view.
      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'Your teams' }));

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      expect(combobox).toHaveDisplayValue('Your teams');
    });

    it("shows unfiltered org-wide alerts when a team member selects 'All teams'", async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      // Own-teams requests see one alert; the unfiltered request also surfaces an
      // alert from another team and one with no team label at all.
      const requests: string[][] = [];
      server.use(
        http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
          const filters = new URL(request.url).searchParams.getAll('filter');
          requests.push(filters);
          const ownAlert = makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical', team: 'Team A' } });
          if (filters.length > 0) {
            return HttpResponse.json([ownAlert]);
          }
          return HttpResponse.json([
            ownAlert,
            makeAlert({ labels: { alertname: 'Disk Full', severity: 'high', team: 'Team C' } }),
            makeAlert({ labels: { alertname: 'Unlabeled Alert', severity: 'low' } }),
          ]);
        })
      );

      const { user } = render(<AlertIncidentTabs />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      const combobox = await screen.findByRole('combobox', { name: /filter alerts by team/i });

      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'All teams' }));

      // The explicit all-teams request carries no team matchers at all.
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]).toEqual([]);

      // Rows include alerts outside the user's teams and without a team label,
      // and the tab counter reflects the unfiltered total.
      expect(await screen.findByText('Disk Full')).toBeInTheDocument();
      expect(screen.getByText('Unlabeled Alert')).toBeInTheDocument();
      expect(screen.getByText('CPU Critical')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /firing alerts/i })).toHaveTextContent('3');
      expect(combobox).toHaveDisplayValue('All teams');
    });

    it("shows the generic empty message when 'All teams' is selected and there are no alerts", async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      // The user's own teams have a firing alert; the org as a whole has none
      // (contrived, but isolates the empty copy for the all-teams scope).
      server.use(
        http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
          const filters = new URL(request.url).searchParams.getAll('filter');
          return HttpResponse.json(
            filters.length === 0 ? [] : [makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]
          );
        })
      );

      const { user } = render(<AlertIncidentTabs />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      await user.click(await screen.findByRole('combobox', { name: /filter alerts by team/i }));
      await user.click(await screen.findByRole('option', { name: 'All teams' }));

      // The sentinel never leaks into copy; the generic empty message is used.
      expect(await screen.findByText('You have no firing alerts.')).toBeInTheDocument();
      expect(screen.queryByText(/No firing alerts for/)).not.toBeInTheDocument();
    });

    it("restores the own-teams filter when selecting 'Your teams' after 'All teams'", async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      const requests = mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      const { user } = render(<AlertIncidentTabs />);

      const ownTeamsFilter = `team=~"(?i)${wireTolerantPattern('Team', 'A')}"`;

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      expect(requests[0]).toEqual([ownTeamsFilter]);
      const combobox = await screen.findByRole('combobox', { name: /filter alerts by team/i });

      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'All teams' }));
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]).toEqual([]);

      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'Your teams' }));

      // Back to the default scope: the request is filtered to the user's own teams again.
      await waitFor(() => expect(combobox).toHaveDisplayValue('Your teams'));
      // RTK Query re-serves the cached own-teams entry rather than refetching, so
      // assert on the requests that were made, not on a new one.
      expect(requests.every((r) => r.length === 0 || r[0] === ownTeamsFilter)).toBe(true);
      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
    });

    it('shows the loading skeleton while the switched team request is in flight, then the filtered alerts', async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);

      // First request (user's teams) resolves immediately; the second (Team C) is
      // held open behind a gate so the in-flight loading state can be observed.
      let releaseSecondRequest!: () => void;
      const secondRequestGate = new Promise<void>((resolve) => (releaseSecondRequest = resolve));
      let alertRequests = 0;
      server.use(
        http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', async () => {
          alertRequests++;
          if (alertRequests > 1) {
            await secondRequestGate;
            return HttpResponse.json([makeAlert({ labels: { alertname: 'Disk Full', severity: 'high' } })]);
          }
          return HttpResponse.json([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);
        })
      );

      const { user } = render(<AlertIncidentTabs />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      expect(screen.queryByTestId('summary-card-skeleton')).not.toBeInTheDocument();

      await user.click(await screen.findByRole('combobox', { name: /filter alerts by team/i }));
      await user.click(await screen.findByRole('option', { name: 'Team C' }));

      // While the filtered request is pending, the skeleton replaces the stale rows.
      expect(await screen.findByTestId('summary-card-skeleton')).toBeInTheDocument();
      expect(screen.queryByText('CPU Critical')).not.toBeInTheDocument();

      releaseSecondRequest();

      expect(await screen.findByText('Disk Full')).toBeInTheDocument();
      expect(screen.queryByTestId('summary-card-skeleton')).not.toBeInTheDocument();
    });

    it('does not refetch when re-selecting the already selected team', async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      const requests = mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      const { user } = render(<AlertIncidentTabs />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      const combobox = await screen.findByRole('combobox', { name: /filter alerts by team/i });

      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'Team C' }));
      await waitFor(() => expect(requests).toHaveLength(2));

      // Picking the same team again is a no-op: no state change, no new request.
      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'Team C' }));

      expect(combobox).toHaveDisplayValue('Team C');
      expect(requests).toHaveLength(2);
    });

    it('shows a team-scoped empty message when the selected team has no alerts', async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      // The user's own teams have a firing alert; the explicitly selected team has none.
      server.use(
        http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
          const filters = new URL(request.url).searchParams.getAll('filter');
          const isSelectedTeamFilter = filters.some((f) => f.includes('Team C'));
          return HttpResponse.json(
            isSelectedTeamFilter ? [] : [makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]
          );
        })
      );

      const { user } = render(<AlertIncidentTabs />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      await user.click(await screen.findByRole('combobox', { name: /filter alerts by team/i }));
      await user.click(await screen.findByRole('option', { name: 'Team C' }));

      // The empty copy names the selected team instead of claiming "your teams".
      expect(await screen.findByText('No firing alerts for Team C.')).toBeInTheDocument();
      expect(screen.queryByText('No firing alerts for your teams.')).not.toBeInTheDocument();
    });

    it('filters the fetched team values client-side as the user types', async () => {
      mockTeamLabelValues(['Team Alpha', 'Team Beta', 'Zebra Squad']);
      mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      const { user } = render(<AlertIncidentTabs />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      const combobox = await screen.findByRole('combobox', { name: /filter alerts by team/i });
      await user.click(combobox);

      // Default list: the default-scope option plus every fetched value. This user
      // belongs to no teams, so the default scope is unfiltered and the option reads
      // "All teams" — exactly once, with no duplicate from the explicit all-teams
      // option team members get.
      expect(await screen.findByRole('option', { name: 'All teams' })).toBeInTheDocument();
      expect(screen.getAllByRole('option', { name: 'All teams' })).toHaveLength(1);
      expect(screen.getByRole('option', { name: 'Team Alpha' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Zebra Squad' })).toBeInTheDocument();

      // Typing narrows the list client-side (case-insensitive contains) and drops
      // the scope sentinels. Use keyboard() instead of type(): type() re-clicks the
      // input, which toggles the menu closed and flushes the selected label into it.
      await user.keyboard('zebra');
      // "Zebra Squad" is already on the unfiltered list, so wait for the others to
      // drop out rather than for it to appear.
      await waitFor(() => expect(screen.queryByRole('option', { name: 'Team Alpha' })).not.toBeInTheDocument());
      expect(screen.getByRole('option', { name: 'Zebra Squad' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'All teams' })).not.toBeInTheDocument();
    });

    it('hides the dropdown when the state-history Prometheus datasource is not configured', async () => {
      config.unifiedAlerting.stateHistory = { ...originalStateHistory, prometheusTargetDatasourceUID: undefined };
      mockTeamLabelValues(['Team A']);
      mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      render(<AlertIncidentTabs />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /filter alerts by team/i })).not.toBeInTheDocument();
    });

    it('sends a slug-style label value as-is and names it in the empty message', async () => {
      mockTeamLabelValues(['platform-monitoring']);
      // No alerts carry the selected team label, so the team-scoped empty copy shows.
      const requests = mockAlerts([]);

      const { user } = render(<AlertIncidentTabs />);

      await user.click(await screen.findByRole('combobox', { name: /filter alerts by team/i }));
      await user.click(await screen.findByRole('option', { name: 'platform-monitoring' }));

      // The selected value is a real label value, so the matcher carries it verbatim.
      await waitFor(() => expect(requests).toContainEqual(['team=~"platform-monitoring"']));
      expect(await screen.findByText('No firing alerts for platform-monitoring.')).toBeInTheDocument();
    });
  });
});
