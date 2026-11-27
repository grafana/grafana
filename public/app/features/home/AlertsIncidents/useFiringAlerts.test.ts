import { http, HttpResponse } from 'msw';
import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertState, type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { canViewFiringAlerts, useFiringAlerts } from './useFiringAlerts';

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

/** Mocks the alerts endpoint; returns the `filter` query params of each request received. */
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

// Wire form of the tolerant pattern's separator gap: quoteWithEscape doubles
// the backslashes when the matcher value is serialized into the filter param.
const WIRE_SEP = '[^\\\\p{L}\\\\p{N}]*';

beforeEach(() => {
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action: string) => action === AccessControlAction.AlertingInstanceRead);
  jest.replaceProperty(contextSrv, 'isSignedIn', true);
  mockTeams([]);
  mockAlerts([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('canViewFiringAlerts', () => {
  it('is true when the user has AlertingInstanceRead permission', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    expect(canViewFiringAlerts()).toBe(true);
  });

  it('is false when the user lacks AlertingInstanceRead permission', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    expect(canViewFiringAlerts()).toBe(false);
  });
});

describe('useFiringAlerts', () => {
  it('does not request user teams for anonymous users', async () => {
    jest.replaceProperty(contextSrv, 'isSignedIn', false);

    const requests: string[] = [];

    server.use(
      http.get('/api/user/teams', ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json([]);
      })
    );

    const { result } = renderHook(() => useFiringAlerts(), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(requests).toEqual([]);
  });

  it('derives counts and severity totals from the fetched alerts', async () => {
    mockAlerts([
      makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } }),
      makeAlert({ labels: { alertname: 'Memory High', severity: 'high' } }),
      makeAlert({ labels: { alertname: 'Disk Warning', severity: 'warning' } }),
    ]);

    const { result } = renderHook(() => useFiringAlerts(), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.count).toBe(3);
    expect(result.current.hasAlerts).toBe(true);
    expect(result.current.criticalCount).toBe(1);
    expect(result.current.highCount).toBe(1);
  });

  it('reports no alerts when the query resolves empty', async () => {
    mockAlerts([]);

    const { result } = renderHook(() => useFiringAlerts(), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.count).toBe(0);
    expect(result.current.hasAlerts).toBe(false);
  });

  it('sets hasTeams when the user belongs to teams', async () => {
    mockTeams([{ name: 'platform' }]);
    mockAlerts([]);

    const { result } = renderHook(() => useFiringAlerts(), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasTeams).toBe(true);
  });

  describe('team matchers', () => {
    it('matches own teams tolerantly: case-insensitive, punctuation as separator gaps', async () => {
      mockTeams([{ name: 'Platform Monitoring' }, { name: 'Team (US)' }]);
      const requests = mockAlerts([]);

      const { result } = renderHook(() => useFiringAlerts(), { wrapper: getWrapper({}) });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Leading/trailing gaps let "Team (US)" still match its own literal label.
      const platform = `${WIRE_SEP}Platform${WIRE_SEP}Monitoring${WIRE_SEP}`;
      const teamUs = `${WIRE_SEP}Team${WIRE_SEP}US${WIRE_SEP}`;
      expect(requests).toEqual([[`team=~"(?i)${platform}|${teamUs}"`]]);
    });

    it('skips teams without letters or digits, sending no matcher when none remain', async () => {
      mockTeams([{ name: '@#$' }]);
      const requests = mockAlerts([]);

      const { result } = renderHook(() => useFiringAlerts(), { wrapper: getWrapper({}) });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(requests).toEqual([[]]);
    });

    it('filters own teams in the browser when their matcher would overflow the request URL', async () => {
      // 50 four-word team names encode to about 10 KB of filter, past what proxies accept in a request line.
      mockTeams(Array.from({ length: 50 }, (_, i) => ({ name: `Team ${i} Platform Ops` })));
      const requests = mockAlerts([
        makeAlert({ labels: { alertname: 'Slugged own team', team: 'team-3-platform-ops' } }),
        makeAlert({ labels: { alertname: 'Upper-cased own team', team: 'TEAM_49_PLATFORM_OPS' } }),
        // Anchored like Alertmanager's regex matchers, so a longer name is another team.
        makeAlert({ labels: { alertname: 'Other team', team: 'team-3-platform-ops-eu' } }),
        makeAlert({ labels: { alertname: 'No team' } }),
      ]);

      const { result } = renderHook(() => useFiringAlerts(), { wrapper: getWrapper({}) });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(requests).toEqual([[]]);
      expect(result.current.visibleAlerts.map(({ alert }) => alert.labels.alertname).sort()).toEqual([
        'Slugged own team',
        'Upper-cased own team',
      ]);
      expect(result.current.count).toBe(2);
    });

    it('matches a picked label exactly, in place of the own-teams default', async () => {
      mockTeams([{ name: 'Platform Monitoring' }]);
      const requests = mockAlerts([]);

      // Picks are values set on real rules, so '.' is a plain character, not a wildcard.
      const { result } = renderHook(() => useFiringAlerts('team:team.one'), { wrapper: getWrapper({}) });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(requests).toEqual([['team="team.one"']]);
    });
  });
});
