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

function mockAlerts(alerts: AlertmanagerAlert[]) {
  server.use(http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () => HttpResponse.json(alerts)));
}

beforeEach(() => {
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action: string) => action === AccessControlAction.AlertingInstanceRead);
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
});
