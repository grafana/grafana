import { http, HttpResponse } from 'msw';
import { type ComponentProps } from 'react';
import { act, render, screen, waitFor } from 'test/test-utils';

import { locationService, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
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

  const stubHomeProbe = (body: Record<string, unknown>, init?: ResponseInit) => {
    server.use(
      http.get('/api/dashboards/home', () => {
        probeCallCount++;
        return HttpResponse.json(body, init);
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

  it('flag off → renders dashboard proxy without probing', async () => {
    // Body would route to <HomePage> if probe fired — proves the flag-off branch is structural.
    stubHomeProbe({ dashboard: {}, meta: { isDefaultHome: true } });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
    expect(probeCallCount).toBe(0);
  });

  it('flag on + bundled default response → renders HomePage', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubHomeProbe({ dashboard: {}, meta: { isDefaultHome: true } });

    render(<HomeRoute {...props} />);

    expect(await screen.findByText(/Welcome to Grafana/i)).toBeInTheDocument();
  });

  it('flag on + classic response with UID → renders dashboard proxy', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubHomeProbe({ dashboard: { uid: 'abc' }, meta: {} });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
  });

  it('flag on + classic response with k8s meta → renders dashboard proxy', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubHomeProbe({ dashboard: {}, meta: { k8s: { name: 'x' } } });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
  });

  it('flag on + k8s resource response → renders dashboard proxy', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubHomeProbe({
      kind: 'Dashboard',
      spec: { title: 'Custom' },
      metadata: { name: 'x' },
      access: {},
    });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
  });

  it('flag on + redirect response → calls locationService.replace', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubHomeProbe({ redirectUri: '/d/abc' });

    render(<HomeRoute {...props} />);

    // test-utils render replaces the locationService singleton with a fresh HistoryWrapper,
    // so spy-before-render doesn't work. Assert on the resulting location instead.
    await waitFor(() => {
      expect(locationService.getLocation().pathname).toContain('/d/abc');
    });
  });

  it('flag on + probe error → falls back to dashboard proxy', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    server.use(
      http.get('/api/dashboards/home', () => {
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      })
    );

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
  });

  it('flag on + meta.isDefaultHome: false (no uid) → renders dashboard proxy', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubHomeProbe({ dashboard: {}, meta: { isDefaultHome: false } });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
  });

  it('flag on + meta.isDefaultHome: true with uid → renders HomePage (backend signal wins)', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubHomeProbe({ dashboard: { uid: 'foo' }, meta: { isDefaultHome: true } });

    render(<HomeRoute {...props} />);

    expect(await screen.findByText(/Welcome to Grafana/i)).toBeInTheDocument();
  });

  it('flag on + no isDefaultHome field → renders dashboard proxy', async () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });
    stubHomeProbe({ dashboard: {}, meta: {} });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
  });
});
