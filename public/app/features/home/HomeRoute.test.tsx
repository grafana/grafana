import { http, HttpResponse } from 'msw';
import { type ComponentProps } from 'react';
import { act, render, screen, waitFor } from 'test/test-utils';

import { locationService, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { MERGED_PREFS_URL } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

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
  });

  afterEach(async () => {
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state
    // updates while the component is still mounted (RTL cleanup runs in a separate afterEach).
    await act(async () => {
      setTestFlags({});
    });
    jest.restoreAllMocks();
  });

  const props = {} as ComponentProps<typeof HomeRoute>;

  it('flag off → renders dashboard proxy without probing merged preferences', async () => {
    stubMergedPreferences({ homeDashboardUID: '' });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
    expect(probeCallCount).toBe(0);
  });

  it('flag on + homeDashboardUID empty → renders HomePage', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubMergedPreferences({ homeDashboardUID: '' });

    render(<HomeRoute {...props} />);

    expect(await screen.findByText(/Welcome to Grafana/i)).toBeInTheDocument();
  });

  it('flag on + homeDashboardUID absent → renders HomePage', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubMergedPreferences({});

    render(<HomeRoute {...props} />);

    expect(await screen.findByText(/Welcome to Grafana/i)).toBeInTheDocument();
  });

  it('flag on + homeDashboardUID present → renders dashboard proxy', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubMergedPreferences({ homeDashboardUID: 'abc' });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
  });

  it('flag on + homeDashboardUID: default-home-dashboard → renders dashboard proxy', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubMergedPreferences({ homeDashboardUID: 'default-home-dashboard' });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
  });

  it('flag on + merged endpoint returns 500 → renders dashboard proxy', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    server.use(
      http.get(MERGED_PREFS_URL, () => {
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      })
    );

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
  });

  it('flag on + homeURL present → calls locationService.replace', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubMergedPreferences({ homeURL: '/d/abc' });

    render(<HomeRoute {...props} />);

    // test-utils render replaces the locationService singleton with a fresh HistoryWrapper,
    // so spy-before-render doesn't work. Assert on the resulting location instead.
    await waitFor(() => {
      expect(locationService.getLocation().pathname).toContain('/d/abc');
    });
  });
});
