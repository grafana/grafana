import { http, HttpResponse } from 'msw';
import { type ComponentProps } from 'react';
import { render, screen, waitFor } from 'test/test-utils';

import { locationService, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { MERGED_PREFS_URL } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import HomeRoute from './HomeRoute';

// Rendering DashboardPageProxy pulls in DashboardScenePage and would force re-mocking
// @grafana/runtime, defeating the MSW migration. HomePage is rendered for real.
jest.mock('../dashboard/containers/DashboardPageProxy', () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-page-proxy-stub" />,
}));

setBackendSrv(backendSrv);
setupMockServer();

describe('HomeRoute', () => {
  let probeCallCount = 0;

  const stubMergedPreferences = (spec: Record<string, unknown>, init?: ResponseInit) => {
    server.use(
      http.get(MERGED_PREFS_URL, () => {
        probeCallCount++;
        return HttpResponse.json({ metadata: {}, spec }, init);
      })
    );
  };

  beforeEach(() => {
    probeCallCount = 0;
    setPluginComponentsHook(() => ({ components: [], isLoading: false }));

    // Deny alerting permission so the FiringAlertsCard renders null
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    // Stub endpoints the alerts/incidents cards probe so unhandled requests don't fail the test
    server.use(
      http.get('/api/user/teams', () => HttpResponse.json([])),
      http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () => HttpResponse.json([])),
      // IncidentsCard checks the IRM/Incident plugins; report them absent so it renders nothing
      http.get('/api/plugins/:pluginId/settings', () => HttpResponse.json({ enabled: false }))
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  const props = {} as ComponentProps<typeof HomeRoute>;

  it('homeDashboardUID empty → renders HomePage', async () => {
    stubMergedPreferences({ homeDashboardUID: '' });

    render(<HomeRoute {...props} />);

    expect(await screen.findByText(/Welcome to Grafana/i)).toBeInTheDocument();
  });

  it('homeDashboardUID absent → renders HomePage', async () => {
    stubMergedPreferences({});

    render(<HomeRoute {...props} />);

    expect(await screen.findByText(/Welcome to Grafana/i)).toBeInTheDocument();
  });

  it('homeDashboardUID present → renders dashboard proxy', async () => {
    stubMergedPreferences({ homeDashboardUID: 'abc' });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
  });

  it('homeDashboardUID: default-home-dashboard → renders dashboard proxy', async () => {
    stubMergedPreferences({ homeDashboardUID: 'default-home-dashboard' });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
  });

  it('merged endpoint returns 500 → renders dashboard proxy', async () => {
    server.use(
      http.get(MERGED_PREFS_URL, () => {
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      })
    );

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
  });

  it('homeURL present → calls locationService.replace', async () => {
    stubMergedPreferences({ homeURL: '/d/abc' });

    render(<HomeRoute {...props} />);

    // test-utils render replaces the locationService singleton with a fresh HistoryWrapper,
    // so spy-before-render doesn't work. Assert on the resulting location instead.
    await waitFor(() => {
      expect(locationService.getLocation().pathname).toContain('/d/abc');
    });
  });

  it('homeDashboardUID and homeURL both present → renders dashboard proxy without redirecting', async () => {
    stubMergedPreferences({ homeDashboardUID: 'abc', homeURL: '/d/other' });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
    expect(locationService.getLocation().pathname).not.toContain('/d/other');
  });
});
