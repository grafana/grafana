import { render, screen, waitFor } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { ComponentTypeWithExtensionMeta, PluginExtensionComponentMeta, PluginExtensionTypes } from '@grafana/data';
import { config, locationService, setPluginComponentsHook } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import * as analytics from '../../Analytics';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { RulesFilter as RulesFilterType } from '../../search/rulesSearchParser';
import { setupPluginsExtensionsHook } from '../../testSetup/plugins';

import RulesFilter from './RulesFilter';

// In-memory storage for UserStorage mock (allows real useSavedSearches hook to run)
// This approach catches bugs in the hook logic, unlike mocking the entire hook.
let mockStorageData: Record<string, string> = {};

// Mock UserStorage class directly (same pattern as useFavoriteDatasources.test.ts)
// This avoids issues with MSW not intercepting requests due to config.namespace
// being evaluated at module load time before jest.mock takes effect
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  UserStorage: jest.fn().mockImplementation((_service: string) => ({
    getItem: jest.fn(async (key: string): Promise<string | null> => {
      return mockStorageData[key] ?? null;
    }),
    setItem: jest.fn(async (key: string, value: string): Promise<void> => {
      mockStorageData[key] = value;
    }),
  })),
}));

// Mock contextSrv for user ID (required by useSavedSearches)
jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: {
      id: 123,
    },
    hasPermission: jest.fn().mockReturnValue(true),
  },
}));

// Grant permission before importing the component since permission check happens at module level
grantUserPermissions([AccessControlAction.AlertingReceiversRead]);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RulesFilterV2 = require('./RulesFilter.v2').default;

let mockFilterState: RulesFilterType = {
  ruleName: '',
  ruleState: undefined,
  dataSourceNames: [],
  freeFormWords: [],
  labels: [],
};
let mockSearchQuery = '';
const mockUpdateFilters = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockClearAll = jest.fn();

jest.mock('../../hooks/useFilteredRules', () => ({
  useRulesFilter: jest.fn(() => ({
    searchQuery: mockSearchQuery,
    filterState: mockFilterState,
    updateFilters: mockUpdateFilters,
    setSearchQuery: mockSetSearchQuery,
    clearAll: mockClearAll,
    hasActiveFilters: false,
    activeFilters: [],
  })),
}));

const useRulesFilterMock = useRulesFilter as jest.MockedFunction<typeof useRulesFilter>;

setupMswServer();

jest.spyOn(analytics, 'trackFilterButtonClick');
jest.spyOn(analytics, 'trackFilterButtonApplyClick');
jest.spyOn(analytics, 'trackFilterButtonClearClick');
jest.spyOn(analytics, 'trackAlertRuleFilterEvent');
jest.spyOn(analytics, 'trackRulesSearchInputCleared');

jest.mock('../../components/rules/MultipleDataSourcePicker', () => {
  const original = jest.requireActual('../../components/rules/MultipleDataSourcePicker');
  return {
    ...original,
    MultipleDataSourcePicker: () => null,
  };
});

jest.mock('../../plugins/useAlertingHomePageExtensions', () => ({
  useAlertingHomePageExtensions: jest.fn(() => {
    const { usePluginComponents } = jest.requireActual('@grafana/runtime');
    const { PluginExtensionPoints } = jest.requireActual('@grafana/data');
    return usePluginComponents({
      extensionPointId: PluginExtensionPoints.AlertingHomePage,
      limitPerPlugin: 1,
    });
  }),
}));

// Note: useSavedSearches is NOT mocked here - the real hook runs with UserStorage mocked above.
// This ensures that issues inside the useSavedSearches hook are caught by these tests.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(), // Silence analytics calls from useSavedSearches
  getDataSourceSrv: () => ({
    getList: jest.fn().mockReturnValue([
      { name: 'Prometheus', uid: 'prometheus-uid' },
      { name: 'Loki', uid: 'loki-uid' },
    ]),
  }),
}));

setupPluginsExtensionsHook();

// Helper function to create mock plugin components
function createMockComponent(pluginId: string): ComponentTypeWithExtensionMeta<{}> {
  function MockComponent() {
    return <div>Test Plugin Component</div>;
  }

  MockComponent.meta = {
    id: `test-component-${pluginId}`,
    pluginId,
    title: 'Test Component',
    description: 'Test plugin component',
    type: PluginExtensionTypes.component,
  } satisfies PluginExtensionComponentMeta;

  return MockComponent as ComponentTypeWithExtensionMeta<{}>;
}

const ui = {
  searchInput: byTestId('search-query-input'),
  filterButton: byRole('button', { name: 'Filter' }),
  applyButton: byTestId('filter-apply-button'),
  clearButton: byTestId('filter-clear-button'),
  ruleNameInput: byTestId('rule-name-input'),
};

beforeEach(() => {
  locationService.replace({ search: '' });
  jest.clearAllMocks();

  // Reset mock storage for useSavedSearches
  mockStorageData = {};

  mockFilterState = {
    ruleName: '',
    ruleState: undefined,
    dataSourceNames: [],
    freeFormWords: [],
    labels: [],
  };
  mockSearchQuery = '';
  // Fully reset mock implementations between tests to avoid leakage across cases
  mockUpdateFilters.mockReset();
  mockSetSearchQuery.mockReset();
  mockClearAll.mockReset();
  mockUpdateFilters.mockImplementation(() => {});
  mockSetSearchQuery.mockImplementation(() => {});
  mockClearAll.mockImplementation(() => {});

  // Restore the default implementation of the hook to use current mock variables
  useRulesFilterMock.mockReset();
  useRulesFilterMock.mockImplementation(() => ({
    searchQuery: mockSearchQuery,
    filterState: mockFilterState,
    updateFilters: mockUpdateFilters,
    setSearchQuery: mockSetSearchQuery,
    clearAll: mockClearAll,
    hasActiveFilters: false,
    activeFilters: [],
  }));

  // Reset plugin components hook to default (no plugins)
  setPluginComponentsHook(() => ({
    components: [],
    isLoading: false,
  }));
});

describe('RulesFilter Feature Flag', () => {
  const originalFeatureToggle = config.featureToggles.alertingFilterV2;

  afterEach(() => {
    config.featureToggles.alertingFilterV2 = originalFeatureToggle;
  });

  it('Should render RulesFilterV2 when alertingFilterV2 feature flag is enabled', async () => {
    config.featureToggles.alertingFilterV2 = true;

    render(<RulesFilter />);

    // Wait for suspense to resolve and check that the V2 filter button is present
    await screen.findByRole('button', { name: 'Filter' });
    expect(ui.filterButton.get()).toBeInTheDocument();
    expect(ui.searchInput.get()).toBeInTheDocument();
  });

  it('Should render RulesFilterV1 when alertingFilterV2 feature flag is disabled', async () => {
    config.featureToggles.alertingFilterV2 = false;

    render(<RulesFilter />);

    // Wait for suspense to resolve and check V1 structure
    await screen.findByText('Search');

    // V1 has search input but no V2-style filter button
    expect(ui.searchInput.get()).toBeInTheDocument();
    expect(ui.filterButton.query()).not.toBeInTheDocument();

    // V1 has a help icon next to the search input
    expect(screen.getByText('Search')).toBeInTheDocument();
  });
});

describe('RulesFilterV2', () => {
  it('Should render component without crashing', async () => {
    render(<RulesFilterV2 />);

    // Wait for async hook operations (useSavedSearches) to complete
    await waitFor(() => {
      expect(ui.searchInput.get()).toBeInTheDocument();
    });
    expect(ui.filterButton.get()).toBeInTheDocument();
  });

  it('Should allow typing in search input', async () => {
    const { user } = render(<RulesFilterV2 />);

    await user.type(ui.searchInput.get(), 'test search');
    expect(ui.searchInput.get()).toHaveValue('test search');
  });

  it('Should open filter popup when filter button is clicked', async () => {
    const { user } = render(<RulesFilterV2 />);
    await user.click(ui.filterButton.get());
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('Should close popup when clicking outside', async () => {
    const { user } = render(<RulesFilterV2 />);
    await user.click(ui.filterButton.get());
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });

  it('Should clear filters and search field when clicking clear button', async () => {
    const { user } = render(<RulesFilterV2 />);
    await user.type(ui.searchInput.get(), 'test');
    expect(ui.searchInput.get()).toHaveValue('test');
    await user.click(ui.filterButton.get());

    await user.click(ui.clearButton.get());
    expect(ui.ruleNameInput.get()).toHaveValue('');

    // Check that setSearchQuery was called with undefined to clear the search
    expect(mockSetSearchQuery).toHaveBeenCalledWith(undefined);
  });

  it('Should populate search field with query string when filters are applied via rule name', async () => {
    const { user, rerender } = render(<RulesFilterV2 />);

    await user.click(ui.filterButton.get());

    await user.type(ui.ruleNameInput.get(), 'test');

    // Mock updateFilters to update the search query as the implementation does
    mockUpdateFilters.mockImplementation(() => {
      mockSearchQuery = 'rule:test';
    });

    await user.click(ui.applyButton.get());

    // Update the mock to return the new search query and re-render
    useRulesFilterMock.mockReturnValue({
      searchQuery: mockSearchQuery,
      filterState: mockFilterState,
      updateFilters: mockUpdateFilters,
      setSearchQuery: mockSetSearchQuery,
      clearAll: mockClearAll,
      hasActiveFilters: false,
      activeFilters: [],
    });
    rerender(<RulesFilterV2 />);

    // The search input should reflect the updated query string
    expect(ui.searchInput.get()).toHaveValue('rule:test');
  });

  it('Should parse search query and call updateFilters when user types directly in search field', async () => {
    const { user, rerender } = render(<RulesFilterV2 />);

    // Type a search query directly into the search input
    await user.type(ui.searchInput.get(), 'rule:test state:firing');

    // Trigger the onBlur handler by clicking elsewhere
    await user.click(document.body);

    // Verify updateFilters was called with the parsed filter
    expect(mockUpdateFilters).toHaveBeenCalledWith({
      dataSourceNames: [],
      freeFormWords: [],
      labels: [],
      ruleName: 'test',
      ruleState: 'firing',
    });

    // Simulate the filter state update by updating our mock
    mockFilterState = {
      dataSourceNames: [],
      freeFormWords: [],
      labels: [],
      ruleName: 'test',
      ruleState: PromAlertingRuleState.Firing,
    };

    // Update the mock to return the new state
    useRulesFilterMock.mockReturnValue({
      searchQuery: mockSearchQuery,
      filterState: mockFilterState,
      updateFilters: mockUpdateFilters,
      setSearchQuery: mockSetSearchQuery,
      clearAll: mockClearAll,
      hasActiveFilters: false,
      activeFilters: [],
    });

    // Force a re-render to pick up the new filter state
    rerender(<RulesFilterV2 />);

    // Open the filter popup
    await user.click(ui.filterButton.get());

    expect(ui.ruleNameInput.get()).toHaveValue('test');

    const firingRadio = screen.getByRole('radio', { name: 'Firing' });
    expect(firingRadio).toBeChecked();
  });

  it('Should handle free-form rule name search in query string', async () => {
    const { user } = render(<RulesFilterV2 />);

    // Type a free-form search (no filter prefix)
    await user.type(ui.searchInput.get(), 'test');

    // Trigger the search by pressing Enter
    await user.keyboard('{Enter}');

    // The search input should retain the value
    expect(ui.searchInput.get()).toHaveValue('test');
  });

  describe('Conditional Fields', () => {
    it('Should show contact point field when user has proper permissions', async () => {
      // Permission is already mocked to true at module level
      const { user } = render(<RulesFilterV2 />);
      await user.click(ui.filterButton.get());
      expect(await screen.findByText('Contact point')).toBeInTheDocument();
    });

    it('Should show plugin filter when plugins are enabled', async () => {
      // Mock plugin components to simulate plugins available
      setPluginComponentsHook(() => ({
        components: [createMockComponent('test-plugin')],
        isLoading: false,
      }));

      const { user } = render(<RulesFilterV2 />);
      await user.click(ui.filterButton.get());
      expect(await screen.findByText('Plugin rules')).toBeInTheDocument();
    });

    it('Should hide plugin filter when no plugins are available', async () => {
      // Mock plugin components to return no components
      setPluginComponentsHook(() => ({
        components: [],
        isLoading: false,
      }));

      const { user } = render(<RulesFilterV2 />);
      await user.click(ui.filterButton.get());
      expect(screen.queryByText('Plugin rules')).not.toBeInTheDocument();
    });
  });

  describe('Analytics Tracking', () => {
    it('Should track filter button clicks when opening popup', async () => {
      const { user } = render(<RulesFilterV2 />);

      await user.click(ui.filterButton.get());

      expect(analytics.trackFilterButtonClick).toHaveBeenCalledTimes(1);
    });

    it('Should track clear button clicks', async () => {
      const { user } = render(<RulesFilterV2 />);

      await user.click(ui.filterButton.get());
      await user.click(ui.clearButton.get());

      expect(analytics.trackFilterButtonClearClick).toHaveBeenCalledTimes(1);
    });

    it('Should track apply button clicks with filter values', async () => {
      const { user } = render(<RulesFilterV2 />);

      await user.click(ui.filterButton.get());
      await user.click(ui.applyButton.get());

      expect(analytics.trackFilterButtonApplyClick).toHaveBeenCalledTimes(1);
    });

    it('Should track search input submit with parsed filter payload', async () => {
      const { user } = render(<RulesFilterV2 />);

      await user.type(ui.searchInput.get(), 'rule:test state:firing');
      await user.keyboard('{Enter}');

      expect(analytics.trackAlertRuleFilterEvent).toHaveBeenCalled();
      const callArg = (analytics.trackAlertRuleFilterEvent as jest.Mock).mock.calls.at(-1)?.[0];
      expect(callArg.filterMethod).toBe('search-input');
      expect(callArg.filterVariant).toBe('v2');
      expect(callArg.filter).toMatchObject({ ruleName: 'test', ruleState: 'firing' });
    });

    it('Should track search input blur with parsed filter payload', async () => {
      const { user } = render(<RulesFilterV2 />);

      await user.type(ui.searchInput.get(), 'state:firing');
      await user.click(document.body);

      expect(analytics.trackAlertRuleFilterEvent).toHaveBeenCalled();
      const callArg = (analytics.trackAlertRuleFilterEvent as jest.Mock).mock.calls.at(-1)?.[0];
      expect(callArg.filterMethod).toBe('search-input');
      expect(callArg.filterVariant).toBe('v2');
      expect(callArg.filter).toMatchObject({ ruleState: 'firing' });
    });

    it('Should track search input clear when input transitions to empty', async () => {
      const { user } = render(<RulesFilterV2 />);

      await user.type(ui.searchInput.get(), 'abc');
      expect(ui.searchInput.get()).toHaveValue('abc');
      await user.clear(ui.searchInput.get());

      expect(analytics.trackRulesSearchInputCleared).toHaveBeenCalled();
    });

    it('Should not track filter button click when filter button is clicked to close popup', async () => {
      const { user } = render(<RulesFilterV2 />);

      await user.click(ui.filterButton.get());
      expect(analytics.trackFilterButtonClick).toHaveBeenCalledTimes(1);

      await user.click(document.body);

      jest.clearAllMocks();

      await user.click(ui.filterButton.get());
      expect(analytics.trackFilterButtonClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Saved Searches', () => {
    it('Should auto-apply default saved search on first navigation', async () => {
      // Set up a saved search marked as default
      const defaultSavedSearch = {
        id: 'test-id',
        name: 'Default Search',
        query: 'state:firing',
        isDefault: true,
        createdAt: Date.now(),
      };
      mockStorageData.savedSearches = JSON.stringify([defaultSavedSearch]);

      // Clear session storage to simulate fresh navigation (not a refresh)
      sessionStorage.removeItem('grafana.alerting.alertRules.visited.123');

      render(<RulesFilterV2 />);

      // Wait for the auto-apply to happen
      await waitFor(() => {
        expect(mockUpdateFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            ruleState: 'firing',
          })
        );
      });
    });

    it('Should not auto-apply default saved search on page refresh', async () => {
      // Set up a saved search marked as default
      const defaultSavedSearch = {
        id: 'test-id',
        name: 'Default Search',
        query: 'state:firing',
        isDefault: true,
        createdAt: Date.now(),
      };
      mockStorageData.savedSearches = JSON.stringify([defaultSavedSearch]);

      // Set session storage to simulate a page refresh (already visited)
      sessionStorage.setItem('grafana.alerting.alertRules.visited.123', 'true');

      render(<RulesFilterV2 />);

      // Wait for component to fully render
      await waitFor(() => {
        expect(ui.searchInput.get()).toBeInTheDocument();
      });

      // updateFilters should not have been called with the saved search
      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });

    it('Should not auto-apply default saved search when URL has search parameter', async () => {
      // Set up a saved search marked as default
      const defaultSavedSearch = {
        id: 'test-id',
        name: 'Default Search',
        query: 'state:firing',
        isDefault: true,
        createdAt: Date.now(),
      };
      mockStorageData.savedSearches = JSON.stringify([defaultSavedSearch]);

      // Clear session storage to simulate fresh navigation
      sessionStorage.removeItem('grafana.alerting.alertRules.visited.123');

      // Set URL search parameter
      locationService.replace({ search: '?search=state:pending' });

      render(<RulesFilterV2 />);

      // Wait for component to fully render
      await waitFor(() => {
        expect(ui.searchInput.get()).toBeInTheDocument();
      });

      // updateFilters should not have been called with the default saved search
      // (URL parameter takes precedence)
      expect(mockUpdateFilters).not.toHaveBeenCalledWith(
        expect.objectContaining({
          ruleState: 'firing',
        })
      );
    });
  });
});
