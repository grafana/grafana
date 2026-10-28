import { http, HttpResponse } from 'msw';
import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { makeAlert, mockAlerts, mockTeams } from './alertIncidentTabsTestUtils';
import { HOME_CARD_MAX_ITEMS } from './constants';
import { canViewFiringAlerts, useFiringAlerts } from './useFiringAlerts';

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
