import { http, HttpResponse } from 'msw';
import { type ComponentProps } from 'react';
import { render, screen, waitFor, within } from 'test/test-utils';

import { useMergedPreferencesQuery } from '@grafana/api-clients/rtkq/preferences/v1';
import { locationService, setBackendSrv, setPluginComponentHook, setPluginComponentsHook } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { mockComboboxRect } from '@grafana/test-utils';
import { MERGED_PREFS_URL } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import HomeRoute from './HomeRoute';
import { homepageViewed } from './analytics/main';
import { HOME_PAGE_STORAGE_KEY, HOME_PAGE_STORAGE_SERVICE } from './useHomePageChoice';

// Rendering DashboardPageProxy pulls in DashboardScenePage and would force re-mocking
// @grafana/runtime, defeating the MSW migration. HomePage is rendered for real.
jest.mock('../dashboard/containers/DashboardPageProxy', () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-page-proxy-stub" />,
}));

jest.mock('./analytics/main', () => ({
  ctaClicked: jest.fn(),
  tabChanged: jest.fn(),
  clearHistoryClicked: jest.fn(),
  homepageViewed: jest.fn(),
}));

// Call through by default so MSW-backed tests keep working; override only for the
// cached-data-after-error case that is hard to reproduce via the network layer.
jest.mock('@grafana/api-clients/rtkq/preferences/v1', () => {
  const actual = jest.requireActual('@grafana/api-clients/rtkq/preferences/v1');
  return {
    ...actual,
    useMergedPreferencesQuery: jest.fn(actual.useMergedPreferencesQuery),
  };
});

setBackendSrv(backendSrv);
setupMockServer();
mockComboboxRect();

const useMergedPreferencesQueryMock = jest.mocked(useMergedPreferencesQuery);
const actualUseMergedPreferencesQuery = jest.requireActual('@grafana/api-clients/rtkq/preferences/v1')
  .useMergedPreferencesQuery as typeof useMergedPreferencesQuery;

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
    jest.clearAllMocks();
    useMergedPreferencesQueryMock.mockImplementation(actualUseMergedPreferencesQuery);
    probeCallCount = 0;
    window.localStorage.clear();
    setPluginComponentsHook(() => ({ components: [], isLoading: false }));
    setPluginComponentHook(() => ({ component: null, isLoading: false }));

    // Deny alerting permission so the alerts tab is not offered
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    // Stub endpoints the alerts/incidents cards probe so unhandled requests don't fail the test
    server.use(
      http.get('/api/user/teams', () => HttpResponse.json([])),
      http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () => HttpResponse.json([])),
      // The incidents and on-call tabs check the IRM/Incident plugins; report them absent so neither is offered
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
    expect(jest.mocked(homepageViewed)).toHaveBeenCalledTimes(1);
  });

  it('homeDashboardUID absent → renders HomePage', async () => {
    stubMergedPreferences({});

    render(<HomeRoute {...props} />);

    expect(await screen.findByText(/Welcome to Grafana/i)).toBeInTheDocument();
    expect(jest.mocked(homepageViewed)).toHaveBeenCalledTimes(1);
  });

  it('homeDashboardUID present → renders dashboard proxy', async () => {
    stubMergedPreferences({ homeDashboardUID: 'abc' });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
    expect(jest.mocked(homepageViewed)).not.toHaveBeenCalled();
  });

  it('homeDashboardUID: default-home-dashboard → renders dashboard proxy', async () => {
    stubMergedPreferences({ homeDashboardUID: 'default-home-dashboard' });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
    expect(jest.mocked(homepageViewed)).not.toHaveBeenCalled();
  });

  it('merged endpoint returns 500 → renders HomePage', async () => {
    server.use(
      http.get(MERGED_PREFS_URL, () => {
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      })
    );

    render(<HomeRoute {...props} />);

    expect(await screen.findByText(/Welcome to Grafana/i)).toBeInTheDocument();
    expect(jest.mocked(homepageViewed)).toHaveBeenCalledTimes(1);
  });

  it('prefs error with cached homeDashboardUID → still renders dashboard proxy', async () => {
    // Simulate RTK Query keeping previous data after a failed refetch.
    useMergedPreferencesQueryMock.mockReturnValue({
      data: { metadata: {}, spec: { homeDashboardUID: 'abc' } },
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useMergedPreferencesQuery>);

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
    expect(jest.mocked(homepageViewed)).not.toHaveBeenCalled();
  });

  it('homeURL present → calls locationService.replace', async () => {
    stubMergedPreferences({ homeURL: '/d/abc' });

    render(<HomeRoute {...props} />);

    // test-utils render replaces the locationService singleton with a fresh HistoryWrapper,
    // so spy-before-render doesn't work. Assert on the resulting location instead.
    await waitFor(() => {
      expect(locationService.getLocation().pathname).toContain('/d/abc');
    });
    expect(jest.mocked(homepageViewed)).not.toHaveBeenCalled();
  });

  it('homeDashboardUID and homeURL both present → renders dashboard proxy without redirecting', async () => {
    stubMergedPreferences({ homeDashboardUID: 'abc', homeURL: '/d/other' });

    render(<HomeRoute {...props} />);

    expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
    expect(locationService.getLocation().pathname).not.toContain('/d/other');
    expect(jest.mocked(homepageViewed)).not.toHaveBeenCalled();
  });
  describe('homeURL pointing at a Grafana Page', () => {
    // Typed loosely because the hook is generic over the props each caller asks for
    const PageViewStub = (props: object) => <div data-testid="page-view-stub">{JSON.stringify(props)}</div>;

    beforeEach(() => {
      setPluginComponentHook((id) => ({
        component: id === 'grafana-assistant-app/page-view/v1' ? PageViewStub : null,
        isLoading: false,
      }));
    });

    it('renders the page at / instead of redirecting', async () => {
      stubMergedPreferences({ homeURL: '/a/grafana-assistant-app/pages/mimir-querier-profiling-6463a7ebb3cb' });

      render(<HomeRoute {...props} />);

      expect(await screen.findByTestId('page-view-stub')).toHaveTextContent('mimir-querier-profiling-6463a7ebb3cb');
      expect(screen.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)/ })).toBeInTheDocument();
      expect(
        screen.getByText(
          (_, element) => element?.tagName === 'P' && /change your home page/.test(element.textContent ?? '')
        )
      ).toBeInTheDocument();
      expect(locationService.getLocation().pathname).not.toContain('/a/grafana-assistant-app');
    });

    it('accepts a page UUID and a trailing slug segment', async () => {
      stubMergedPreferences({
        homeURL: '/a/grafana-assistant-app/pages/6463a7eb-3cb1-4a2b-9c3d-6463a7ebb3cb/my-page?orgId=1',
      });

      render(<HomeRoute {...props} />);

      expect(await screen.findByTestId('page-view-stub')).toHaveTextContent('6463a7eb-3cb1-4a2b-9c3d-6463a7ebb3cb');
    });

    it('redirects for Assistant page routes that are not a single page', async () => {
      stubMergedPreferences({ homeURL: '/a/grafana-assistant-app/pages/templates' });

      render(<HomeRoute {...props} />);

      await waitFor(() => {
        expect(locationService.getLocation().pathname).toContain('/a/grafana-assistant-app/pages/templates');
      });
      expect(screen.queryByTestId('page-view-stub')).not.toBeInTheDocument();
    });

    it('falls back to the homepage when the Assistant does not expose the page view', async () => {
      setPluginComponentHook(() => ({ component: null, isLoading: false }));
      stubMergedPreferences({ homeURL: '/a/grafana-assistant-app/pages/mimir-querier-profiling-6463a7ebb3cb' });

      render(<HomeRoute {...props} />);

      expect(await screen.findByText(/Welcome to Grafana/i)).toBeInTheDocument();
      expect(screen.queryByTestId('page-view-stub')).not.toBeInTheDocument();
    });

    it('homeDashboardUID still wins over a page homeURL', async () => {
      stubMergedPreferences({
        homeDashboardUID: 'abc',
        homeURL: '/a/grafana-assistant-app/pages/mimir-querier-profiling-6463a7ebb3cb',
      });

      render(<HomeRoute {...props} />);

      expect(await screen.findByTestId('dashboard-page-proxy-stub')).toBeInTheDocument();
      expect(screen.queryByTestId('page-view-stub')).not.toBeInTheDocument();
    });
  });
  describe('a Grafana Page the user picked', () => {
    const PAGE_ID = '6463a7eb-3cb1-4a2b-9c3d-6463a7ebb3cb';
    const PageViewStub = (props: object) => <div data-testid="page-view-stub">{JSON.stringify(props)}</div>;

    beforeEach(() => {
      setPluginComponentHook((id) => ({
        component: id === 'grafana-assistant-app/page-view/v1' ? PageViewStub : null,
        isLoading: false,
      }));
      server.use(
        http.get('/api/plugins/grafana-assistant-app/resources/api/v1/page-catalog', () =>
          HttpResponse.json({ data: { pages: [{ id: PAGE_ID, title: 'Mimir querier profiling' }] } })
        )
      );
    });

    it('renders over a home dashboard from preferences', async () => {
      await new UserStorage(HOME_PAGE_STORAGE_SERVICE).setItem(HOME_PAGE_STORAGE_KEY, PAGE_ID);
      stubMergedPreferences({ homeDashboardUID: 'abc' });

      render(<HomeRoute {...props} />);

      expect(await screen.findByTestId('page-view-stub')).toHaveTextContent(PAGE_ID);
      expect(screen.queryByTestId('dashboard-page-proxy-stub')).not.toBeInTheDocument();
    });

    it('can be picked from the homepage', async () => {
      stubMergedPreferences({});
      const { user } = render(<HomeRoute {...props} />);

      await user.click(await screen.findByRole('button', { name: 'Use a page as home' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: /Mimir querier profiling/ }));
      await user.click(within(dialog).getByRole('button', { name: 'Set as home' }));

      expect(await screen.findByTestId('page-view-stub')).toHaveTextContent(PAGE_ID);
      expect(await new UserStorage(HOME_PAGE_STORAGE_SERVICE).getItem(HOME_PAGE_STORAGE_KEY)).toBe(PAGE_ID);
    });

    it('offers no picker when the Assistant does not expose the page view', async () => {
      setPluginComponentHook(() => ({ component: null, isLoading: false }));
      stubMergedPreferences({});

      render(<HomeRoute {...props} />);

      expect(await screen.findByText(/Welcome to Grafana/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Use a page as home' })).not.toBeInTheDocument();
    });
  });
});
