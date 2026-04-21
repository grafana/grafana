import { comboboxTestSetup } from 'test/helpers/comboboxTestSetup';
import { render, screen, testWithFeatureToggles } from 'test/test-utils';

import { SearchLayout, type SearchState } from 'app/features/search/types';

import { BrowseFilters } from './BrowseFilters';

const mockUseSearchStateManager = jest.fn();
const mockSearchTeamsQuery = jest.fn();
const mockGetSortOptions = jest.fn().mockResolvedValue([]);

jest.mock('app/features/search/state/SearchStateManager', () => ({
  useSearchStateManager: () => mockUseSearchStateManager(),
}));

jest.mock('app/features/search/service/searcher', () => ({
  getGrafanaSearcher: () => ({
    getSortOptions: mockGetSortOptions,
    sortPlaceholder: 'Sort',
  }),
}));

jest.mock('app/api/clients/legacy', () => ({
  legacyAPI: {
    reducerPath: 'legacyAPI',
    reducer: (state = {}) => state,
    middleware: () => (next: (action: unknown) => unknown) => (action: unknown) => next(action),
  },
  useSearchTeamsQuery: (...args: unknown[]) => mockSearchTeamsQuery(...args),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: jest.fn(() => true),
    user: { uid: 1, orgId: 1 },
  },
}));

comboboxTestSetup();

const createSearchState = (partial?: Partial<SearchState>): SearchState => ({
  query: '',
  tag: [],
  ownerReference: [],
  starred: false,
  layout: SearchLayout.Folders,
  eventTrackingNamespace: 'dashboard_search',
  deleted: false,
  ...partial,
});

const createStateManager = () => ({
  getTagOptions: jest.fn().mockResolvedValue([]),
  onLayoutChange: jest.fn(),
  onStarredFilterChange: jest.fn(),
  onSortChange: jest.fn(),
  onTagFilterChange: jest.fn(),
  onDatasourceChange: jest.fn(),
  onPanelTypeChange: jest.fn(),
  onSetIncludePanels: jest.fn(),
  onCreatedByChange: jest.fn(),
  onOwnerReferenceChange: jest.fn(),
});

describe('BrowseFilters', () => {
  testWithFeatureToggles({ enable: ['teamFolders'] });

  beforeEach(() => {
    mockSearchTeamsQuery.mockReturnValue({
      data: {
        teams: [
          { uid: 'team-a', name: 'Team A', avatarUrl: '' },
          { uid: 'test-team', name: 'Test Team', avatarUrl: '' },
        ],
      },
      isLoading: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the owner filter with the all teams option and user teams', async () => {
    const stateManager = createStateManager();
    mockUseSearchStateManager.mockReturnValue([createSearchState(), stateManager]);

    const { user } = render(<BrowseFilters />);

    await user.click(await screen.findByRole('combobox', { name: 'Owner filter' }));

    expect(await screen.findByText('All teams')).toBeInTheDocument();
    expect(await screen.findByText('Team A')).toBeInTheDocument();
    expect(await screen.findByText('Test Team')).toBeInTheDocument();
  });

  it('normalizes a team selection into ownerReference values', async () => {
    const stateManager = createStateManager();
    mockUseSearchStateManager.mockReturnValue([createSearchState(), stateManager]);

    const { user } = render(<BrowseFilters />);

    await user.click(await screen.findByRole('combobox', { name: 'Owner filter' }));
    await user.click(await screen.findByText('Team A'));

    expect(stateManager.onOwnerReferenceChange).toHaveBeenCalledWith(['iam.grafana.app/Team/team-a']);
  });

  it('normalizes the all teams option into all ownerReference values', async () => {
    const stateManager = createStateManager();
    mockUseSearchStateManager.mockReturnValue([createSearchState(), stateManager]);

    const { user } = render(<BrowseFilters />);

    await user.click(await screen.findByRole('combobox', { name: 'Owner filter' }));
    await user.click(await screen.findByText('All teams'));

    expect(stateManager.onOwnerReferenceChange).toHaveBeenCalledWith([
      'iam.grafana.app/Team/team-a',
      'iam.grafana.app/Team/test-team',
    ]);
  });
});
