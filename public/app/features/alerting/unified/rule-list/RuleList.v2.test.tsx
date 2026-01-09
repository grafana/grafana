import { HttpResponse } from 'msw';
import { render, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { OrgRole } from '@grafana/data';
import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions, grantUserRole, mockDataSource } from '../mocks';
import { setGrafanaRuleGroupExportResolver } from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';
import { RulesFilter } from '../search/rulesSearchParser';
import { setupDataSources } from '../testSetup/datasources';

import RuleListPage, { RuleListActions } from './RuleList.v2';
import { loadDefaultSavedSearch } from './filter/useSavedSearches';

// This tests only checks if proper components are rendered, so we mock them
// Both FilterView and GroupedView are tested in their own tests
jest.mock('./FilterView', () => ({
  FilterView: () => <div data-testid="filter-view">Filter View</div>,
}));

jest.mock('./GroupedView', () => ({
  GroupedView: () => <div data-testid="grouped-view">Grouped View</div>,
}));

jest.mock('./filter/useSavedSearches', () => ({
  ...jest.requireActual('./filter/useSavedSearches'),
  loadDefaultSavedSearch: jest.fn(),
  useSavedSearches: jest.fn(() => ({
    savedSearches: [],
    isLoading: false,
    saveSearch: jest.fn(),
    renameSearch: jest.fn(),
    deleteSearch: jest.fn(),
    setDefaultSearch: jest.fn(),
  })),
}));

const loadDefaultSavedSearchMock = loadDefaultSavedSearch as jest.MockedFunction<typeof loadDefaultSavedSearch>;

beforeEach(() => {
  loadDefaultSavedSearchMock.mockResolvedValue(null);
  // Clear session storage to ensure clean state for each test
  // This prevents the "visited" flag from affecting subsequent tests
  sessionStorage.clear();
  // Set the visited flag for non-default-search tests to prevent the hook from trying to load
  sessionStorage.setItem('grafana.alerting.ruleList.visited', 'true');
});

const ui = {
  filterView: byTestId('filter-view'),
  groupedView: byTestId('grouped-view'),
  modeSelector: {
    grouped: byRole('radio', { name: /grouped/i }),
    list: byRole('radio', { name: /list/i }),
  },
  searchInput: byTestId('search-query-input'),
};

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);
testWithFeatureToggles({ enable: ['alertingListViewV2'] });

setupMswServer();

alertingFactory.dataSource.build({ name: 'Mimir', uid: 'mimir' });
alertingFactory.dataSource.build({ name: 'Prometheus', uid: 'prometheus' });

describe('RuleListPage v2', () => {
  it('should show grouped view by default', () => {
    render(<RuleListPage />);

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it('should show grouped view when invalid view parameter is provided', () => {
    render(<RuleListPage />, {
      historyOptions: {
        initialEntries: ['/?view=invalid'],
      },
    });

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it('should show list view when "view=list" URL parameter is present', () => {
    render(<RuleListPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    expect(ui.filterView.get()).toBeInTheDocument();
    expect(ui.groupedView.query()).not.toBeInTheDocument();
  });

  it('should show grouped view when only group filter is applied', () => {
    render(<RuleListPage />, { historyOptions: { initialEntries: ['/?search=group:cpu-usage'] } });

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it('should show grouped view when only namespace filter is applied', () => {
    render(<RuleListPage />, { historyOptions: { initialEntries: ['/?search=namespace:global'] } });

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it('should show grouped view when both group and namespace filters are applied', () => {
    render(<RuleListPage />, { historyOptions: { initialEntries: ['/?search=group:cpu-usage namespace:global'] } });

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it('should show list view when group and namespace filters are combined with other filter types', () => {
    render(<RuleListPage />, {
      historyOptions: { initialEntries: ['/?search=group:cpu-usage namespace:global state:firing'] },
    });

    expect(ui.filterView.get()).toBeInTheDocument();
    expect(ui.groupedView.query()).not.toBeInTheDocument();
  });

  it('should show grouped view when view parameter is empty', () => {
    render(<RuleListPage />, { historyOptions: { initialEntries: ['/?view='] } });

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it('should show grouped view when search parameter is empty', () => {
    render(<RuleListPage />, { historyOptions: { initialEntries: ['/?search='] } });

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it.each<{ filterType: keyof RulesFilter; searchQuery: string }>([
    { filterType: 'freeFormWords', searchQuery: 'cpu alert' },
    { filterType: 'ruleName', searchQuery: 'rule:"cpu 80%"' },
    { filterType: 'ruleState', searchQuery: 'state:firing' },
    { filterType: 'ruleType', searchQuery: 'type:alerting' },
    { filterType: 'dataSourceNames', searchQuery: 'datasource:prometheus' },
    { filterType: 'labels', searchQuery: 'label:team=backend' },
    { filterType: 'ruleHealth', searchQuery: 'health:error' },
    { filterType: 'contactPoint', searchQuery: 'contactPoint:slack' },
  ])('should show list view when %s filter is applied', ({ filterType, searchQuery }) => {
    render(<RuleListPage />, { historyOptions: { initialEntries: [`/?search=${encodeURIComponent(searchQuery)}`] } });

    expect(ui.filterView.get()).toBeInTheDocument();
    expect(ui.groupedView.query()).not.toBeInTheDocument();
  });

  it('should show list view when "view=list" URL parameter is present with group filter', () => {
    render(<RuleListPage />, { historyOptions: { initialEntries: ['/?view=list&search=group:cpu-usage'] } });

    expect(ui.filterView.get()).toBeInTheDocument();
    expect(ui.groupedView.query()).not.toBeInTheDocument();
  });

  it('should show list view when "view=list" URL parameter is present with namespace filter', () => {
    render(<RuleListPage />, { historyOptions: { initialEntries: ['/?view=list&search=namespace:global'] } });

    expect(ui.filterView.get()).toBeInTheDocument();
    expect(ui.groupedView.query()).not.toBeInTheDocument();
  });

  it('should show list view when "view=list" URL parameter is present with both group and namespace filters', () => {
    render(<RuleListPage />, {
      historyOptions: { initialEntries: ['/?view=list&search=group:cpu-usage namespace:global'] },
    });

    expect(ui.filterView.get()).toBeInTheDocument();
    expect(ui.groupedView.query()).not.toBeInTheDocument();
  });
});

describe('RuleListActions', () => {
  const ui = {
    newRuleButton: byRole('link', { name: /^new alert rule$/i }),
    moreButton: byRole('button', { name: /more/i }),
    moreMenu: byRole('menu'),
    menuOptions: {
      newAlertRuleForExport: byRole('link', { name: /new alert rule for export/i }),
      newGrafanaRecordingRule: byRole('link', { name: /new grafana recording rule/i }),
      newDataSourceRecordingRule: byRole('link', { name: /new data source recording rule/i }),
      importAlertRules: byRole('link', { name: /import alert rules/i }),
      exportAllGrafanaRules: byRole('menuitem', { name: /export all grafana rules/i }),
    },
    exportDrawer: byRole('dialog', { name: /export/i }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default to Viewer role (non-admin)
    grantUserRole(OrgRole.Viewer);
  });

  it.each([
    { permissions: [AccessControlAction.AlertingRuleCreate] },
    { permissions: [AccessControlAction.AlertingRuleExternalWrite] },
    { permissions: [AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingRuleExternalWrite] },
  ])('should show "New alert rule" button when the user has $permissions permissions', ({ permissions }) => {
    grantUserPermissions(permissions);

    render(<RuleListActions />);

    expect(ui.newRuleButton.get()).toBeInTheDocument();
    expect(ui.moreButton.get()).toBeInTheDocument();
  });

  it('should not show "New alert rule" button when user has no permissions to create rules', () => {
    grantUserPermissions([]);

    render(<RuleListActions />);

    expect(ui.newRuleButton.query()).not.toBeInTheDocument();
    expect(ui.moreButton.get()).toBeInTheDocument();
  });

  it('should only show New alert rule for export when the user has view Grafana rules permission', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);

    const { user } = render(<RuleListActions />);

    await user.click(ui.moreButton.get());
    const menu = await ui.moreMenu.find();

    expect(ui.newRuleButton.query()).not.toBeInTheDocument();
    expect(ui.menuOptions.newAlertRuleForExport.query(menu)).toBeInTheDocument();
    expect(ui.menuOptions.newGrafanaRecordingRule.query(menu)).not.toBeInTheDocument();
    expect(ui.menuOptions.newDataSourceRecordingRule.query(menu)).not.toBeInTheDocument();
  });

  it('should show "New Grafana recording rule" option when user has Grafana rule permissions', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);

    const { user } = render(<RuleListActions />);

    await user.click(ui.moreButton.get());
    const menu = await ui.moreMenu.find();

    expect(ui.menuOptions.newAlertRuleForExport.query(menu)).toBeInTheDocument();
    expect(ui.menuOptions.newGrafanaRecordingRule.query(menu)).toBeInTheDocument();
    expect(ui.menuOptions.newDataSourceRecordingRule.query(menu)).not.toBeInTheDocument();
  });

  it('should show "New Data source recording rule" option when user has external rule permissions', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleExternalWrite]);

    const { user } = render(<RuleListActions />);

    await user.click(ui.moreButton.get());
    const menu = await ui.moreMenu.find();

    expect(ui.menuOptions.newAlertRuleForExport.query(menu)).toBeInTheDocument();
    expect(ui.menuOptions.newGrafanaRecordingRule.query(menu)).not.toBeInTheDocument();
    expect(ui.menuOptions.newDataSourceRecordingRule.query(menu)).toBeInTheDocument();
  });

  it('should show both recording rule options when user has all permissions', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingRuleExternalWrite]);

    const { user } = render(<RuleListActions />);

    await user.click(ui.moreButton.get());
    const menu = await ui.moreMenu.find();

    expect(ui.menuOptions.newAlertRuleForExport.query(menu)).toBeInTheDocument();
    expect(ui.menuOptions.newGrafanaRecordingRule.query(menu)).toBeInTheDocument();
    expect(ui.menuOptions.newDataSourceRecordingRule.query(menu)).toBeInTheDocument();
  });

  describe('Import Alert Rules', () => {
    testWithFeatureToggles({ enable: ['alertingMigrationUI'] });

    it('should show "Import alert rules" option when user has required permissions and feature toggle is enabled', async () => {
      grantUserPermissions([
        AccessControlAction.AlertingRuleRead,
        AccessControlAction.AlertingRuleCreate,
        AccessControlAction.AlertingProvisioningSetStatus,
      ]);

      const { user } = render(<RuleListActions />);

      await user.click(ui.moreButton.get());
      const menu = await ui.moreMenu.find();

      expect(ui.menuOptions.importAlertRules.query(menu)).toBeInTheDocument();
    });

    it('should not show "Import alert rules" option when user lacks required permissions', async () => {
      // Keep default Viewer role and only read permissions
      grantUserPermissions([AccessControlAction.AlertingRuleRead]);

      const { user } = render(<RuleListActions />);

      await user.click(ui.moreButton.get());
      const menu = await ui.moreMenu.find();

      expect(ui.menuOptions.importAlertRules.query(menu)).not.toBeInTheDocument();
    });

    it('should have correct URL for "Import alert rules" menu item', async () => {
      grantUserPermissions([
        AccessControlAction.AlertingRuleRead,
        AccessControlAction.AlertingRuleCreate,
        AccessControlAction.AlertingProvisioningSetStatus,
      ]);

      const { user } = render(<RuleListActions />);

      await user.click(ui.moreButton.get());
      const menu = await ui.moreMenu.find();
      const importMenuItem = ui.menuOptions.importAlertRules.get(menu);

      expect(importMenuItem).toHaveAttribute('href', '/alerting/import-datasource-managed-rules');
    });
  });

  describe('Export All Grafana Rules', () => {
    it('should show "Export all Grafana rules" option when user has export permissions', async () => {
      grantUserPermissions([AccessControlAction.AlertingRuleRead]);

      const { user } = render(<RuleListActions />);

      await user.click(ui.moreButton.get());
      const menu = await ui.moreMenu.find();

      expect(ui.menuOptions.exportAllGrafanaRules.query(menu)).toBeInTheDocument();
    });

    it('should not show "Export all Grafana rules" option when user lacks export permissions', async () => {
      grantUserPermissions([]); // No permissions

      const { user } = render(<RuleListActions />);

      await user.click(ui.moreButton.get());
      const menu = await ui.moreMenu.find();

      expect(ui.menuOptions.exportAllGrafanaRules.query(menu)).not.toBeInTheDocument();
    });

    it('should open export drawer when "Export all Grafana rules" is clicked', async () => {
      // Set up MSW mock for export endpoint
      setGrafanaRuleGroupExportResolver(() => {
        return HttpResponse.text('# Mock YAML export content\ngroups: []');
      });

      grantUserPermissions([AccessControlAction.AlertingRuleRead]);

      const { user } = render(<RuleListActions />);

      await user.click(ui.moreButton.get());
      const menu = await ui.moreMenu.find();
      const exportMenuItem = ui.menuOptions.exportAllGrafanaRules.get(menu);

      await user.click(exportMenuItem);

      expect(ui.exportDrawer.query()).toBeInTheDocument();
    });
  });

  describe('Data source options visibility', () => {
    it('should not show "New Data source recording rule" option when no data sources have manageAlerts enabled', async () => {
      // Set up only data sources with manageAlerts explicitly set to false
      // This replaces the default data sources that have manageAlerts defaulting to true
      setupDataSources(
        mockDataSource({
          name: 'Prometheus-disabled',
          uid: 'prometheus-disabled',
          type: 'prometheus',
          jsonData: { manageAlerts: false },
        })
      );

      grantUserPermissions([AccessControlAction.AlertingRuleExternalWrite]);

      const { user } = render(<RuleListActions />);

      await user.click(ui.moreButton.get());
      const menu = await ui.moreMenu.find();

      expect(ui.menuOptions.newDataSourceRecordingRule.query(menu)).not.toBeInTheDocument();
    });

    it('should show "New Data source recording rule" option when data sources have manageAlerts enabled', async () => {
      // Set up data source with manageAlerts enabled
      setupDataSources(
        mockDataSource({
          name: 'Prometheus-enabled',
          uid: 'prometheus-enabled',
          type: 'prometheus',
          jsonData: { manageAlerts: true },
        })
      );

      grantUserPermissions([AccessControlAction.AlertingRuleExternalWrite]);

      const { user } = render(<RuleListActions />);

      await user.click(ui.moreButton.get());
      const menu = await ui.moreMenu.find();

      expect(ui.menuOptions.newDataSourceRecordingRule.query(menu)).toBeInTheDocument();
    });
  });
});

describe('RuleListPage v2 - View switching', () => {
  it('should preserve both group and namespace filters when switching from list view to grouped view', async () => {
    // Start with list view and both group and namespace filters
    const { user } = render(<RuleListPage />, {
      historyOptions: { initialEntries: ['/?view=list&search=group:cpu-usage namespace:global'] },
    });
    expect(ui.filterView.get()).toBeInTheDocument();

    // Click the "Grouped" view button
    const groupedButton = await ui.modeSelector.grouped.find();
    await user.click(groupedButton);

    // Should preserve both filters and switch to grouped view
    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();

    // Verify filters are preserved
    expect(ui.searchInput.get()).toHaveValue('group:cpu-usage namespace:global');
    expect(ui.modeSelector.list.query()).not.toBeChecked();
  });

  it('should clear all filters when switching from list view to grouped view with group, namespace and other filters', async () => {
    // Start with list view with all types of filters
    const { user } = render(<RuleListPage />, {
      historyOptions: {
        initialEntries: ['/?view=list&search=group:cpu-usage namespace:global state:firing rule:"test"'],
      },
    });
    expect(ui.filterView.get()).toBeInTheDocument();

    // Click the "Grouped" view button
    const groupedButton = await ui.modeSelector.grouped.find();
    await user.click(groupedButton);

    // Should clear all filters because other filters are present
    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();

    // Verify all filters are cleared
    expect(ui.searchInput.get()).toHaveValue('');
    expect(ui.modeSelector.list.query()).not.toBeChecked();
  });
});
describe('RuleListPage v2 - Default search auto-apply', () => {
  // These tests verify that the default search is applied at the page level,
  // BEFORE child components mount, preventing double API requests.

  testWithFeatureToggles({ enable: ['alertingListViewV2', 'alertingSavedSearches'] });

  beforeEach(() => {
    // Clear the visited flag so the hook detects this as a first visit
    sessionStorage.removeItem('grafana.alerting.ruleList.visited');
    // Clear mock call history between tests
    loadDefaultSavedSearchMock.mockClear();
  });

  it('should apply default search before rendering child components', async () => {
    const mockDefaultSearch = {
      id: '1',
      name: 'My Default',
      query: 'state:firing',
      isDefault: true,
      createdAt: Date.now(),
    };

    // Mock loadDefaultSavedSearch to return a default search
    loadDefaultSavedSearchMock.mockResolvedValue(mockDefaultSearch);

    render(<RuleListPage />);

    // Wait for loadDefaultSavedSearch to be called
    await waitFor(() => {
      expect(loadDefaultSavedSearchMock).toHaveBeenCalled();
    });

    // Wait for the filter view to render with the applied search
    await waitFor(() => {
      expect(ui.filterView.get()).toBeInTheDocument();
    });

    // Verify the search input shows the applied search query
    expect(ui.searchInput.get()).toHaveValue('state:firing');
  });

  it('should not apply default search when URL already has search parameter', async () => {
    const mockDefaultSearch = {
      id: '1',
      name: 'My Default',
      query: 'state:firing',
      isDefault: true,
      createdAt: Date.now(),
    };

    // loadDefaultSavedSearch should not be called when URL has search param
    loadDefaultSavedSearchMock.mockResolvedValue(mockDefaultSearch);

    render(<RuleListPage />, {
      historyOptions: { initialEntries: ['/?search=label:team=backend'] },
    });

    // Wait for the component to render
    await waitFor(() => {
      expect(ui.searchInput.get()).toBeInTheDocument();
    });

    // Should show the URL's search, not the default
    expect(ui.searchInput.get()).toHaveValue('label:team=backend');

    // Verify loadDefaultSavedSearch was not called because filters are already active
    // The hook should not execute at all when hasActiveFilters is true
    expect(loadDefaultSavedSearchMock).not.toHaveBeenCalled();
  });

  it('should render normally when no default search exists', async () => {
    loadDefaultSavedSearchMock.mockResolvedValue(null);

    render(<RuleListPage />);

    // Wait for the component to render after checking for default search
    await waitFor(() => {
      expect(ui.groupedView.get()).toBeInTheDocument();
    });

    expect(ui.searchInput.get()).toHaveValue('');
  });
});
