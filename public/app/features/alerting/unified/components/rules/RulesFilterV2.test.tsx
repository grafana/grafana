import { render, screen } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { ComponentTypeWithExtensionMeta, PluginExtensionComponentMeta, PluginExtensionTypes } from '@grafana/data';
import { config, locationService, setPluginComponentsHook } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import * as analytics from '../../Analytics';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { RulesFilter as RulesFilterType } from '../../search/rulesSearchParser';
import { setupPluginsExtensionsHook } from '../../testSetup/plugins';

// Mock contextSrv before importing the component since permission check happens at module level
jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

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

import RulesFilter from './Filter/RulesFilter';
import RulesFilterV2 from './Filter/RulesFilter.v2';

const useRulesFilterMock = useRulesFilter as jest.MockedFunction<typeof useRulesFilter>;

setupMswServer();

jest.spyOn(analytics, 'trackFilterButtonClick');
jest.spyOn(analytics, 'trackFilterButtonApplyClick');
jest.spyOn(analytics, 'trackFilterButtonClearClick');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: jest.fn().mockReturnValue([
      { name: 'Prometheus', uid: 'prometheus-uid' },
      { name: 'Loki', uid: 'loki-uid' },
    ]),
  }),
}));

jest.mock('./MultipleDataSourcePicker', () => {
  const original = jest.requireActual('./MultipleDataSourcePicker');
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

  mockFilterState = {
    ruleName: '',
    ruleState: undefined,
    dataSourceNames: [],
    freeFormWords: [],
    labels: [],
  };
  mockSearchQuery = '';
  mockUpdateFilters.mockClear();
  mockSetSearchQuery.mockClear();
  mockClearAll.mockClear();
  mockSetSearchQuery.mockImplementation(() => {});

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
  it('Should render component without crashing', () => {
    render(<RulesFilterV2 />);

    expect(ui.searchInput.get()).toBeInTheDocument();
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
    const { user } = render(<RulesFilterV2 />);

    await user.click(ui.filterButton.get());

    await user.type(ui.ruleNameInput.get(), 'test');

    // Mock the setSearchQuery to update mockSearchQuery
    mockSetSearchQuery.mockImplementation((newQuery: string | undefined) => {
      mockSearchQuery = newQuery ?? '';
    });

    await user.click(ui.applyButton.get());

    // Check that setSearchQuery was called with the expected query
    expect(mockSetSearchQuery).toHaveBeenCalledWith('rule:test');
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
      expect(screen.getByText('Contact point')).toBeInTheDocument();
    });

    it('Should show plugin filter when plugins are enabled', async () => {
      // Mock plugin components to simulate plugins available
      setPluginComponentsHook(() => ({
        components: [createMockComponent('test-plugin')],
        isLoading: false,
      }));

      const { user } = render(<RulesFilterV2 />);
      await user.click(ui.filterButton.get());
      expect(screen.getByText('Plugin rules')).toBeInTheDocument();
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
});
