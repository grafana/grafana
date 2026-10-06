import { act, render, screen } from 'test/test-utils';

import { setBackendSrv, useScopes } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { MegaMenu } from './MegaMenu';
import { customisableNavTree } from './__mocks__/fixtures';

// The org switcher fetches user orgs on mount when signed in, which is irrelevant here.
jest.mock('../OrganizationSwitcher/OrganizationSwitcher', () => ({
  OrganizationSwitcher: () => null,
}));

// No starred-items fixture is needed for these tests; stub the searcher so the sync is a no-op.
jest.mock('app/features/search/service/searcher');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useScopes: jest.fn(),
}));

jest.mock('app/features/scopes/ScopesContextProvider', () => ({
  ...jest.requireActual('app/features/scopes/ScopesContextProvider'),
  useScopesServices: jest.fn(),
}));

const mockUseScopes = jest.mocked(useScopes);
const mockUseScopesServices = jest.mocked(useScopesServices);

const FLAG = 'grafana.scopesDashboardsMegaMenu';
const CUSTOMISE_FLAG = 'grafana.customizableMegaMenu';

interface MockDashboardsServiceState {
  loading: boolean;
  forScopeNames: string[];
  dashboards: unknown[];
  scopeNavigations: Array<{ title: string; url: string }>;
  searchQuery: string;
  filteredFolders: Record<string, unknown>;
}

const makeScopesServices = (
  overrides: Partial<MockDashboardsServiceState> = {}
): ReturnType<typeof useScopesServices> =>
  ({
    scopesService: {},
    scopesSelectorService: {},
    scopesDashboardsService: {
      stateObservable: { subscribe: () => ({ unsubscribe: () => {} }) },
      state: {
        loading: false,
        forScopeNames: ['scope-a'],
        dashboards: [],
        scopeNavigations: [{ title: 'Suggested dashboard', url: '/d/abc' }],
        searchQuery: '',
        filteredFolders: {},
        ...overrides,
      },
      changeSearchQuery: jest.fn(),
      updateFolder: jest.fn(),
      clearSearchQuery: jest.fn(),
    },
  }) as unknown as ReturnType<typeof useScopesServices>;

setBackendSrv(backendSrv);
setupMockServer();

const renderMegaMenu = () => {
  window.localStorage.clear();
  return render(<MegaMenu onClose={() => {}} />, { preloadedState: { navBarTree: customisableNavTree } });
};

describe('MegaMenu scopes dashboards section', () => {
  beforeEach(() => {
    server.resetHandlers();
    jest.mocked(getGrafanaSearcher).mockReturnValue({
      search: jest.fn().mockResolvedValue({ view: { length: 0, get: () => undefined } }),
    } as unknown as ReturnType<typeof getGrafanaSearcher>);
  });

  afterEach(async () => {
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state updates
    // while MegaMenu may still be mounted (RTL's own cleanup afterEach runs after this one).
    await act(async () => {
      setTestFlags({});
    });
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('is absent when the flag is off, regardless of scopes state', async () => {
    mockUseScopes.mockReturnValue({ state: { enabled: true } } as ReturnType<typeof useScopes>);
    mockUseScopesServices.mockReturnValue(makeScopesServices());

    renderMegaMenu();

    expect(screen.queryByText('Suggested dashboards')).not.toBeInTheDocument();
  });

  it('is absent when scopes are not enabled, even with the flag on', async () => {
    setTestFlags({ [FLAG]: true });
    mockUseScopes.mockReturnValue({ state: { enabled: false } } as ReturnType<typeof useScopes>);
    mockUseScopesServices.mockReturnValue(makeScopesServices());

    renderMegaMenu();

    expect(screen.queryByText('Suggested dashboards')).not.toBeInTheDocument();
  });

  it('is absent when scopes are read-only, even with the flag on and dashboards available', async () => {
    setTestFlags({ [FLAG]: true });
    mockUseScopes.mockReturnValue({ state: { enabled: true, readOnly: true } } as ReturnType<typeof useScopes>);
    mockUseScopesServices.mockReturnValue(makeScopesServices());

    renderMegaMenu();

    expect(screen.queryByText('Suggested dashboards')).not.toBeInTheDocument();
  });

  it('renders between the pinned box and the nav list when canCustomise is true', async () => {
    setTestFlags({ [FLAG]: true, [CUSTOMISE_FLAG]: true });
    mockUseScopes.mockReturnValue({ state: { enabled: true } } as ReturnType<typeof useScopes>);
    mockUseScopesServices.mockReturnValue(makeScopesServices());

    renderMegaMenu();

    const scopesHeading = await screen.findByText('Suggested dashboards');
    const navList = screen.getByRole('list', { name: 'Navigation' });

    expect(scopesHeading.compareDocumentPosition(navList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders above the nav list when canCustomise is false', async () => {
    setTestFlags({ [FLAG]: true });
    mockUseScopes.mockReturnValue({ state: { enabled: true } } as ReturnType<typeof useScopes>);
    mockUseScopesServices.mockReturnValue(makeScopesServices());

    renderMegaMenu();

    const scopesHeading = await screen.findByText('Suggested dashboards');
    const navList = screen.getByRole('list', { name: 'Navigation' });

    expect(scopesHeading.compareDocumentPosition(navList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
