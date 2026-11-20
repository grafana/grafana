import { http, HttpResponse } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { makeAlert, mockAlerts, mockTeams } from './alertIncidentTabsTestUtils';
import { HOME_CARD_MAX_ITEMS } from './constants';
import { useFiringAlerts } from './useFiringAlerts';

setBackendSrv(backendSrv);
setupMockServer();

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

describe('enabled', () => {
  afterEach(async () => {
    // setTestFlags fires OpenFeature events that update React state while the hook is still mounted
    // (RTL cleanup runs in a later afterEach).
    await act(async () => {
      setTestFlags({});
    });
  });

  it('is true when the user has AlertingInstanceRead permission', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    const { result } = renderHook(() => useFiringAlerts(), { wrapper: getWrapper({}) });

    expect(result.current.enabled).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('is false when the user lacks AlertingInstanceRead permission', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    const { result } = renderHook(() => useFiringAlerts(), { wrapper: getWrapper({}) });

    expect(result.current.enabled).toBe(false);
    // The skipped teams lookup still settles useAsync a tick later.
    await act(async () => {});
  });

  it('is false on a multi-tenant homepage even with permission, without requesting teams or alerts', async () => {
    setTestFlags({ [FlagKeys.GrafanaMultiTenantHomepage]: true });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    const requests: string[] = [];
    server.use(
      http.get('/api/user/teams', ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json([]);
      })
    );
    const alertRequests = mockAlerts([]);

    const { result } = renderHook(() => useFiringAlerts(), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.enabled).toBe(false));
    expect(result.current.loading).toBe(false);
    // The skipped teams lookup still settles useAsync a tick later.
    await act(async () => {});
    expect(requests).toEqual([]);
    expect(alertRequests).toEqual([]);
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

  it('caps the visible alerts while the counts cover every alert', async () => {
    mockAlerts(
      Array.from({ length: HOME_CARD_MAX_ITEMS + 1 }, (_, i) =>
        makeAlert({ labels: { alertname: `Alert ${i}`, severity: 'critical' } })
      )
    );

    const { result } = renderHook(() => useFiringAlerts(), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.visibleAlerts).toHaveLength(HOME_CARD_MAX_ITEMS);
    expect(result.current.count).toBe(HOME_CARD_MAX_ITEMS + 1);
    expect(result.current.criticalCount).toBe(HOME_CARD_MAX_ITEMS + 1);
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

  it.each([
    ['a 500', () => HttpResponse.json({ message: 'nope' }, { status: 500 })],
    [
      'an HTML body',
      () => HttpResponse.text('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    ],
  ])('falls back to unfiltered alerts when the teams lookup returns %s', async (_, respond) => {
    server.use(http.get('/api/user/teams', respond));
    const requests = mockAlerts([]);

    const { result } = renderHook(() => useFiringAlerts(), { wrapper: getWrapper({}) });

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toEqual([]);
    expect(result.current.hasTeams).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
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
