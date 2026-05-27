import { render, screen, waitFor } from 'test/test-utils';
import { byTestId } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import * as analytics from '../../Analytics';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { type RulesFilter as RulesFilterType } from '../../search/rulesSearchParser';
import { setupPluginsExtensionsHook } from '../../testSetup/plugins';

import RulesFilter from './RulesFilter.v2';

// Mock config for UserStorage (namespace and user must be set before UserStorage module loads)
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  getDataSourceSrv: () => ({
    getList: jest.fn().mockReturnValue([
      { name: 'Prometheus', uid: 'prometheus-uid' },
      { name: 'Loki', uid: 'loki-uid' },
    ]),
  }),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    namespace: 'default',
    bootData: {
      ...jest.requireActual('@grafana/runtime').config.bootData,
      navTree: [],
      user: {
        uid: 'test-user-123',
        id: 123,
        isSignedIn: true,
      },
    },
  },
}));

jest.mock('app/core/services/context_srv', () => {
  const actual = jest.requireActual('app/core/services/context_srv');
  return {
    ...actual,
    contextSrv: {
      ...actual.contextSrv,
      user: {
        ...actual.contextSrv.user,
        id: 123,
      },
      hasPermission: jest.fn().mockReturnValue(true),
    },
  };
});

// Grant permission before importing the component since permission check happens at module load time
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

jest.spyOn(analytics, 'trackAlertRuleFilterEvent');
jest.spyOn(analytics, 'trackRulesSearchInputCleared');

// Set up MSW server with UserStorage handlers (also sets up beforeAll/afterEach Jest hooks)
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
setupMswServer();

jest.mock('../../components/rules/MultipleDataSourcePicker', () => {
  const original = jest.requireActual('../../components/rules/MultipleDataSourcePicker');
  return {
    ...original,
    MultipleDataSourcePicker: () => null,
  };
});

setupPluginsExtensionsHook();

const ui = {
  searchInput: byTestId('search-query-input'),
};

beforeEach(() => {
  locationService.replace({ search: '' });
  jest.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();

  mockFilterState = {
    ruleName: '',
    ruleState: undefined,
    dataSourceNames: [],
    freeFormWords: [],
    labels: [],
  };
  mockSearchQuery = '';

  mockUpdateFilters.mockReset();
  mockSetSearchQuery.mockReset();
  mockClearAll.mockReset();
  mockUpdateFilters.mockImplementation(() => {});
  mockSetSearchQuery.mockImplementation(() => {});
  mockClearAll.mockImplementation(() => {});

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
});

describe('RulesFilter', () => {
  it('Should render RulesFilterV2', async () => {
    render(<RulesFilter />);

    // Wait for suspense to resolve and check that the search input is present
    await waitFor(() => {
      expect(ui.searchInput.get()).toBeInTheDocument();
    });
    // V2 no longer has a popup filter button — filters live in the sidebar
    expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument();
  });
});

describe('RulesFilterV2', () => {
  it('Should render component without crashing', async () => {
    render(<RulesFilterV2 />);

    await waitFor(() => {
      expect(ui.searchInput.get()).toBeInTheDocument();
    });
    // No popup filter button — filters are in the sidebar now
    expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument();
  });

  it('Should allow typing in search input', async () => {
    const { user } = render(<RulesFilterV2 />);

    await user.type(ui.searchInput.get(), 'test search');
    expect(ui.searchInput.get()).toHaveValue('test search');
  });

  it('Should populate search field from external filter state update', async () => {
    const { rerender } = render(<RulesFilterV2 />);

    await waitFor(() => expect(ui.searchInput.get()).toBeInTheDocument());

    mockSearchQuery = 'rule:test';
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

    await waitFor(() => expect(ui.searchInput.get()).toHaveValue('rule:test'));
  });

  it('Should handle free-form rule name search in query string', async () => {
    const { user } = render(<RulesFilterV2 />);

    await user.type(ui.searchInput.get(), 'test');
    await user.keyboard('{Enter}');

    expect(ui.searchInput.get()).toHaveValue('test');
  });

  describe('Analytics Tracking', () => {
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
      expect(callArg.filter).toMatchObject({ ruleState: PromAlertingRuleState.Firing });
    });

    it('Should track search input clear when input transitions to empty', async () => {
      const { user } = render(<RulesFilterV2 />);

      await user.type(ui.searchInput.get(), 'abc');
      expect(ui.searchInput.get()).toHaveValue('abc');
      await user.clear(ui.searchInput.get());

      expect(analytics.trackRulesSearchInputCleared).toHaveBeenCalled();
    });
  });

  // Auto-apply of default search is tested in RuleList.v2.test.tsx (behavior is in RuleListPage)
});
