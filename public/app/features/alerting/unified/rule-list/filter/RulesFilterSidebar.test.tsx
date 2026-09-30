import { render, screen, waitFor, within } from 'test/test-utils';

import { locationService, setReturnToPreviousHook } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { useRulesFilter } from '../../hooks/useFilteredRules';
import { setupMswServer } from '../../mockApi';
import type { RulesFilter } from '../../search/rulesSearchParser';
import { setupPrometheusAlertingPlugin } from '../../testSetup/prometheusAlertingPlugin';
import { SupportedPlugin } from '../../types/pluginBridges';

import { RulesFilterSidebar } from './RulesFilterSidebar';

jest.mock('@grafana/runtime', () => {
  const runtime = jest.requireActual('@grafana/runtime');
  return {
    ...runtime,
    locationService: {
      ...runtime.locationService,
      push: jest.fn(),
    },
  };
});

jest.mock('@grafana/alerting/unstable', () => ({
  ContactPointSelector: ({
    onChange,
    value,
    disabled,
  }: {
    onChange: (cp: { spec: { title: string } } | null) => void;
    value?: string | null;
    disabled?: boolean;
  }) => (
    <select
      aria-label="Contact point"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v ? { spec: { title: v } } : null);
      }}
    >
      <option value="">Select contact point</option>
      <option value="slack-cp">slack-cp</option>
    </select>
  ),
  RoutingTreeSelector: ({
    onChange,
    value,
    disabled,
  }: {
    onChange: (tree: { metadata: { name: string } } | null) => void;
    value?: string;
    disabled?: boolean;
  }) => (
    <select
      aria-label="Notification policy"
      value={value ?? ''}
      disabled={disabled}
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

setupMswServer();

const mockUpdateFilters = jest.fn();
const mockClearAll = jest.fn();
const returnToPrevious = jest.fn();

setReturnToPreviousHook(() => returnToPrevious);

const baseFilterState: RulesFilter = { freeFormWords: [], dataSourceNames: [], labels: [] };

jest.mock('../../hooks/useFilteredRules', () => ({
  useRulesFilter: jest.fn(),
}));

const useRulesFilterMock = jest.mocked(useRulesFilter);

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

describe('RulesFilterSidebar — mutual exclusivity of contact point and policy filters', () => {
  beforeEach(() => {
    // canRenderContactPointSelector is evaluated per-render (not at module load),
    // so spyOn intercepts it correctly to grant the receivers permission.
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  it('disables the policy selector when a contact point is selected', async () => {
    const { user } = render(<RulesFilterSidebar />);

    const contactPointSelect = await screen.findByRole('combobox', { name: 'Contact point' });
    expect(await screen.findByRole('combobox', { name: 'Notification policy' })).toBeEnabled();

    await user.selectOptions(contactPointSelect, 'slack-cp');

    // Re-query: the DOM node is replaced when the Tooltip wrapper is added
    expect(await screen.findByRole('combobox', { name: 'Notification policy' })).toBeDisabled();
  });

  it('disables the contact point selector when a policy is selected', async () => {
    const { user } = render(<RulesFilterSidebar />);

    const policySelect = await screen.findByRole('combobox', { name: 'Notification policy' });

    await user.selectOptions(policySelect, 'team-a-policy');

    expect(await screen.findByRole('combobox', { name: 'Contact point' })).toBeDisabled();
  });

  it('does not include policy in the filter update when a contact point is selected', async () => {
    const { user } = render(<RulesFilterSidebar />);

    const contactPointSelect = await screen.findByRole('combobox', { name: 'Contact point' });
    await user.selectOptions(contactPointSelect, 'slack-cp');

    expect(mockUpdateFilters).toHaveBeenLastCalledWith(expect.objectContaining({ contactPoint: 'slack-cp' }));
    expect(mockUpdateFilters).toHaveBeenLastCalledWith(expect.not.objectContaining({ policy: expect.anything() }));
  });

  it('does not include contactPoint in the filter update when a policy is selected', async () => {
    const { user } = render(<RulesFilterSidebar />);

    const policySelect = await screen.findByRole('combobox', { name: 'Notification policy' });
    await user.selectOptions(policySelect, 'team-a-policy');

    expect(mockUpdateFilters).toHaveBeenLastCalledWith(expect.objectContaining({ policy: 'team-a-policy' }));
    expect(mockUpdateFilters).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ contactPoint: expect.anything() })
    );
  });

  it('re-enables the policy selector when the contact point is cleared', async () => {
    const { user } = render(<RulesFilterSidebar />);

    const contactPointSelect = await screen.findByRole('combobox', { name: 'Contact point' });

    await user.selectOptions(contactPointSelect, 'slack-cp');
    expect(await screen.findByRole('combobox', { name: 'Notification policy' })).toBeDisabled();

    await user.selectOptions(contactPointSelect, '');
    expect(await screen.findByRole('combobox', { name: 'Notification policy' })).toBeEnabled();
  });

  it('re-enables the contact point selector when the policy is cleared', async () => {
    const { user } = render(<RulesFilterSidebar />);

    const policySelect = await screen.findByRole('combobox', { name: 'Notification policy' });

    await user.selectOptions(policySelect, 'team-a-policy');
    expect(await screen.findByRole('combobox', { name: 'Contact point' })).toBeDisabled();

    await user.selectOptions(policySelect, '');
    expect(await screen.findByRole('combobox', { name: 'Contact point' })).toBeEnabled();
  });

  it('initializes with the policy selector disabled when the URL has contactPoint set', async () => {
    useRulesFilterMock.mockReturnValue({
      filterState: { freeFormWords: [], dataSourceNames: [], labels: [], contactPoint: 'slack-cp' },
      updateFilters: mockUpdateFilters,
      hasActiveFilters: true,
      clearAll: mockClearAll,
      searchQuery: 'contactPoint:slack-cp',
      setSearchQuery: jest.fn(),
      activeFilters: ['contactPoint'],
    });

    render(<RulesFilterSidebar />);

    const policySelect = await screen.findByRole('combobox', { name: 'Notification policy' });
    expect(policySelect).toBeDisabled();
  });

  it('initializes with the contact point selector disabled when the URL has policy set', async () => {
    useRulesFilterMock.mockReturnValue({
      filterState: { freeFormWords: [], dataSourceNames: [], labels: [], policy: 'team-a-policy' },
      updateFilters: mockUpdateFilters,
      hasActiveFilters: true,
      clearAll: mockClearAll,
      searchQuery: 'policy:team-a-policy',
      setSearchQuery: jest.fn(),
      activeFilters: ['policy'],
    });

    render(<RulesFilterSidebar />);

    const contactPointSelect = await screen.findByRole('combobox', { name: 'Contact point' });
    expect(contactPointSelect).toBeDisabled();
  });

  it('never receives both contactPoint and policy -- conflicts are resolved at query ingestion', async () => {
    useRulesFilterMock.mockReturnValue({
      filterState: { freeFormWords: [], dataSourceNames: [], labels: [], policy: 'team-a-policy' },
      updateFilters: mockUpdateFilters,
      hasActiveFilters: true,
      clearAll: mockClearAll,
      searchQuery: 'policy:team-a-policy',
      setSearchQuery: jest.fn(),
      activeFilters: ['policy'],
    });

    render(<RulesFilterSidebar />);

    const contactPointSelect = await screen.findByRole('combobox', { name: 'Contact point' });
    const policySelect = screen.getByRole('combobox', { name: 'Notification policy' });

    expect(contactPointSelect).toHaveValue('');
    expect(contactPointSelect).toBeDisabled();
    expect(policySelect).toHaveValue('team-a-policy');
    expect(policySelect).toBeEnabled();
  });
});

describe('RulesFilterSidebar — rule source filter', () => {
  it('offers the rule source filter while data source managed rules are still in this list', async () => {
    render(<RulesFilterSidebar />);

    expect(await screen.findByRole('radiogroup', { name: 'Rule source' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Data source managed' })).toBeInTheDocument();
  });
});

describe('RulesFilterSidebar — rule source filter with the Prometheus Alerting plugin', () => {
  setupPrometheusAlertingPlugin();

  it('defaults to Grafana managed without offering All when the plugin owns data source managed rules', async () => {
    render(<RulesFilterSidebar />);

    expect(await screen.findByText('Data source')).toBeInTheDocument();
    const ruleSourceFilter = screen.getByRole('radiogroup', { name: 'Rule source' });
    const grafanaManaged = within(ruleSourceFilter).getByRole('radio', { name: 'Grafana managed' });
    await waitFor(() => expect(grafanaManaged).toBeChecked());
    expect(within(ruleSourceFilter).queryByRole('radio', { name: 'All' })).not.toBeInTheDocument();
    expect(within(ruleSourceFilter).getByRole('radio', { name: 'Data source managed' })).not.toBeChecked();
  });

  it('opens data source managed rules in the plugin with the current search query', async () => {
    useRulesFilterMock.mockReturnValue({
      filterState: baseFilterState,
      updateFilters: mockUpdateFilters,
      hasActiveFilters: true,
      clearAll: mockClearAll,
      searchQuery: 'state:firing team=search',
      setSearchQuery: jest.fn(),
      activeFilters: ['ruleState'],
    });
    const { user } = render(<RulesFilterSidebar />);

    const grafanaManaged = await screen.findByRole('radio', { name: 'Grafana managed' });
    await waitFor(() => expect(grafanaManaged).toBeChecked());
    await user.click(screen.getByRole('radio', { name: 'Data source managed' }));

    expect(mockUpdateFilters).not.toHaveBeenCalled();
    expect(returnToPrevious).toHaveBeenCalledWith('Alert rules');
    expect(locationService.push).toHaveBeenCalledWith(
      `/a/${SupportedPlugin.PrometheusAlerting}/rules?search=state%3Afiring+team%3Dsearch`
    );
  });
});
