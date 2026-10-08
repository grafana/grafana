import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom-v5-compat';

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
    push: jest.fn(),
  },
}));

jest.mock('../ScopesContextProvider', () => ({
  ...jest.requireActual('../ScopesContextProvider'),
  useScopesServices: jest.fn(),
}));

const mockUseScopes = useScopes as jest.Mock;
const mockUseScopesServices = useScopesServices as jest.Mock;

interface StateOverrides {
  loading?: boolean;
  forScopeNames?: string[];
  dashboards?: unknown[];
  scopeNavigations?: Array<{ title: string; url: string }>;
  searchQuery?: string;
  filteredFolders?: Record<string, unknown>;
}

const makeScopeServices = (overrides: StateOverrides = {}) => ({
  scopesDashboardsService: {
    stateObservable: { subscribe: () => ({ unsubscribe: () => {} }) },
    state: {
      loading: false,
      forScopeNames: ['scope-a'],
      dashboards: [],
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
});

describe('ScopesDashboardsMegaMenuSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseScopes.mockReturnValue({ state: { enabled: true } });
  });

  it('renders nothing when scope services are unavailable', () => {
    mockUseScopesServices.mockReturnValue(undefined);
    const { container } = render(<ScopesDashboardsMegaMenuSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when scopes are not enabled', () => {
    mockUseScopes.mockReturnValue({ state: { enabled: false } });
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
    mockUseScopesServices.mockReturnValue(
      makeScopeServices({ dashboards: [], scopeNavigations: [], filteredFolders: {} })
    );
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
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScopesDashboardsMegaMenuSection />
      </MemoryRouter>
    );
    expect(screen.getByText('Suggested dashboards')).toBeInTheDocument();
    expect(screen.getByTestId('scopes-dashboards-container')).toBeInTheDocument();
    expect(screen.getByText('Suggested dashboard')).toBeInTheDocument();
  });

  it('shows a no-results state with a clear button when search filters everything out', async () => {
    const user = userEvent.setup();
    const services = makeScopeServices({ searchQuery: 'no-match', filteredFolders: {} });
    mockUseScopesServices.mockReturnValue(services);
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScopesDashboardsMegaMenuSection />
      </MemoryRouter>
    );

    const clearButton = screen.getByTestId('scopes-dashboards-notFoundForFilter-clear');
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);
    expect(services.scopesDashboardsService.clearSearchQuery).toHaveBeenCalled();
  });
});
