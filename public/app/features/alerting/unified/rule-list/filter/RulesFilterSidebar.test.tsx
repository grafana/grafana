import { render, screen, testWithFeatureToggles } from 'test/test-utils';

import { RulesFilter } from '../../search/rulesSearchParser';

import { RulesFilterSidebar } from './RulesFilterSidebar';

jest.mock('@grafana/alerting/unstable', () => ({
  ContactPointSelector: () => null,
  RoutingTreeSelector: ({
    onChange,
    value,
  }: {
    onChange: (tree: { metadata: { name: string } } | null) => void;
    value?: string;
  }) => (
    <select
      aria-label="Notification policy"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v ? { metadata: { name: v } } : null);
      }}
    >
      <option value="">Select policy</option>
      <option value="team-a-policy">team-a-policy</option>
    </select>
  ),
}));

jest.mock('../../components/rules/Filter/useRuleFilterAutocomplete', () => ({
  useNamespaceAndGroupOptions: () => ({
    namespaceOptions: [],
    groupOptions: [],
    namespacePlaceholder: 'Folder',
    groupPlaceholder: 'Group',
  }),
  useLabelOptions: () => ({ labelOptions: [] }),
  useAlertingDataSourceOptions: () => [],
}));

jest.mock('../../plugins/useAlertingHomePageExtensions', () => ({
  useAlertingHomePageExtensions: () => ({ components: [] }),
}));

const mockUpdateFilters = jest.fn();
const mockClearAll = jest.fn();

const baseFilterState: RulesFilter = { freeFormWords: [], dataSourceNames: [], labels: [] };

jest.mock('../../hooks/useFilteredRules', () => ({
  useRulesFilter: jest.fn(() => ({
    filterState: baseFilterState,
    updateFilters: mockUpdateFilters,
    hasActiveFilters: false,
    clearAll: mockClearAll,
    searchQuery: '',
    setSearchQuery: jest.fn(),
    activeFilters: [],
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useRulesFilter } = require('../../hooks/useFilteredRules');
const useRulesFilterMock = useRulesFilter as jest.MockedFunction<typeof useRulesFilter>;

beforeEach(() => {
  jest.clearAllMocks();
  useRulesFilterMock.mockReturnValue({
    filterState: baseFilterState,
    updateFilters: mockUpdateFilters,
    hasActiveFilters: false,
    clearAll: mockClearAll,
    searchQuery: '',
    setSearchQuery: jest.fn(),
    activeFilters: [],
  });
});

describe('RulesFilterSidebar — policy filter', () => {
  describe('when alertingMultiplePolicies is enabled', () => {
    testWithFeatureToggles({ enable: ['alertingMultiplePolicies'] });

    it('renders the notification policy selector', async () => {
      render(<RulesFilterSidebar />);
      expect(await screen.findByRole('combobox', { name: 'Notification policy' })).toBeInTheDocument();
    });

    it('calls updateFilters with the selected policy name', async () => {
      const { user } = render(<RulesFilterSidebar />);
      const select = await screen.findByRole('combobox', { name: 'Notification policy' });
      await user.selectOptions(select, 'team-a-policy');
      expect(mockUpdateFilters).toHaveBeenCalledWith(expect.objectContaining({ policy: 'team-a-policy' }));
    });

    it('does not include policy in the filter when the selection is cleared', async () => {
      const { user } = render(<RulesFilterSidebar />);
      const select = await screen.findByRole('combobox', { name: 'Notification policy' });
      await user.selectOptions(select, 'team-a-policy');
      await user.selectOptions(select, '');
      const lastCall = mockUpdateFilters.mock.calls.at(-1)?.[0];
      expect(lastCall?.policy).toBeUndefined();
    });
  });

  describe('when alertingMultiplePolicies is disabled', () => {
    testWithFeatureToggles({ disable: ['alertingMultiplePolicies'] });

    it('does not render the notification policy selector', async () => {
      render(<RulesFilterSidebar />);
      expect(screen.queryByRole('combobox', { name: 'Notification policy' })).not.toBeInTheDocument();
    });
  });
});
