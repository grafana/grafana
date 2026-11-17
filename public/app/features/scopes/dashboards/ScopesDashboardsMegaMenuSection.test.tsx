import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { useScopes } from '@grafana/runtime';

import { useScopesServices } from '../ScopesContextProvider';

import { ScopesDashboardsMegaMenuSection } from './ScopesDashboardsMegaMenuSection';

jest.mock('app/core/hooks/useQueryParams', () => ({
  useQueryParams: jest.fn(() => [{}]),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useScopes: jest.fn(),
  locationService: {
    ...jest.requireActual('@grafana/runtime').locationService,
    push: jest.fn(),
  },
}));

jest.mock('../ScopesContextProvider', () => ({
  ...jest.requireActual('../ScopesContextProvider'),
  useScopesServices: jest.fn(),
}));

const mockUseScopes = jest.mocked(useScopes);
const mockUseScopesServices = jest.mocked(useScopesServices);

interface StateOverrides {
  loading?: boolean;
  forScopeNames?: string[];
  scopeNavigations?: Array<{ title: string; url: string }>;
  searchQuery?: string;
  filteredFolders?: Record<string, unknown>;
}

const makeScopeServices = (overrides: StateOverrides = {}): NonNullable<ReturnType<typeof useScopesServices>> =>
  ({
    scopesDashboardsService: {
      stateObservable: { subscribe: () => ({ unsubscribe: () => {} }) },
      state: {
        loading: false,
        forScopeNames: ['scope-a'],
        scopeNavigations: [{ title: 'Suggested dashboard', url: '/d/abc' }],
        searchQuery: '',
        filteredFolders: {
          '': {
            title: '',
            expanded: true,
            folders: {},
            suggestedNavigations: {
              'nav-1': { title: 'Suggested dashboard', url: '/d/abc', id: 'nav-1' },
            },
          },
        },
        ...overrides,
      },
      changeSearchQuery: jest.fn(),
      updateFolder: jest.fn(),
      clearSearchQuery: jest.fn(),
    },
  }) as unknown as NonNullable<ReturnType<typeof useScopesServices>>;

describe('ScopesDashboardsMegaMenuSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseScopes.mockReturnValue({ state: { enabled: true } } as ReturnType<typeof useScopes>);
  });

  it('renders nothing when scope services are unavailable', () => {
    mockUseScopesServices.mockReturnValue(undefined);
    const { container } = render(<ScopesDashboardsMegaMenuSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when scopes are not enabled', () => {
    mockUseScopes.mockReturnValue({ state: { enabled: false } } as ReturnType<typeof useScopes>);
    mockUseScopesServices.mockReturnValue(makeScopeServices());
    const { container } = render(<ScopesDashboardsMegaMenuSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no scope is applied', () => {
    mockUseScopesServices.mockReturnValue(makeScopeServices({ forScopeNames: [] }));
    const { container } = render(<ScopesDashboardsMegaMenuSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the applied scope has no suggested content', () => {
    mockUseScopesServices.mockReturnValue(makeScopeServices({ scopeNavigations: [], filteredFolders: {} }));
    const { container } = render(<ScopesDashboardsMegaMenuSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a loading placeholder while fetching, even with stale leftover content', () => {
    mockUseScopesServices.mockReturnValue(makeScopeServices({ loading: true }));
    render(<ScopesDashboardsMegaMenuSection />);
    expect(screen.getByTestId('scopes-dashboards-loading')).toBeInTheDocument();
  });

  it('renders the suggested-dashboards tree when content is available', () => {
    mockUseScopesServices.mockReturnValue(makeScopeServices());
    render(<ScopesDashboardsMegaMenuSection />);
    expect(screen.getByText('Suggested dashboards')).toBeInTheDocument();
    expect(screen.getByTestId('scopes-dashboards-container')).toBeInTheDocument();
    expect(screen.getByText('Suggested dashboard')).toBeInTheDocument();
  });

  it('shows a no-results state with a clear button when search filters everything out', async () => {
    const user = userEvent.setup();
    const services = makeScopeServices({ searchQuery: 'no-match', filteredFolders: {} });
    mockUseScopesServices.mockReturnValue(services);
    render(<ScopesDashboardsMegaMenuSection />);

    const clearButton = screen.getByTestId('scopes-dashboards-notFoundForFilter-clear');
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);
    expect(services.scopesDashboardsService.clearSearchQuery).toHaveBeenCalled();
  });
});
