import { render } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { alertingFactory } from '../mocks/server/db';
import { RulesFilter } from '../search/rulesSearchParser';
import { testWithFeatureToggles } from '../test/test-utils';

import RuleList, { RuleListActions } from './RuleList.v2';

// This tests only checks if proper components are rendered, so we mock them
// Both FilterView and GroupedView are tested in their own tests
jest.mock('./FilterView', () => ({
  FilterView: () => <div data-testid="filter-view">Filter View</div>,
}));

jest.mock('./GroupedView', () => ({
  GroupedView: () => <div data-testid="grouped-view">Grouped View</div>,
}));

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
testWithFeatureToggles(['alertingListViewV2']);

setupMswServer();

alertingFactory.dataSource.build({ name: 'Mimir', uid: 'mimir' });
alertingFactory.dataSource.build({ name: 'Prometheus', uid: 'prometheus' });

describe('RuleList v2', () => {
  it('should show grouped view by default', () => {
    render(<RuleList />);

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it('should show grouped view when invalid view parameter is provided', () => {
    render(<RuleList />, {
      historyOptions: {
        initialEntries: ['/?view=invalid'],
      },
    });

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it('should show list view when "view=list" URL parameter is present', () => {
    render(<RuleList />, { historyOptions: { initialEntries: ['/?view=list'] } });

    expect(ui.filterView.get()).toBeInTheDocument();
    expect(ui.groupedView.query()).not.toBeInTheDocument();
  });

  it('should show grouped view when only group filter is applied', () => {
    render(<RuleList />, { historyOptions: { initialEntries: ['/?search=group:cpu-usage'] } });

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it('should show grouped view when only namespace filter is applied', () => {
    render(<RuleList />, { historyOptions: { initialEntries: ['/?search=namespace:global'] } });

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it('should show grouped view when both group and namespace filters are applied', () => {
    render(<RuleList />, { historyOptions: { initialEntries: ['/?search=group:cpu-usage namespace:global'] } });

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it('should show list view when group and namespace filters are combined with other filter types', () => {
    render(<RuleList />, {
      historyOptions: { initialEntries: ['/?search=group:cpu-usage namespace:global state:firing'] },
    });

    expect(ui.filterView.get()).toBeInTheDocument();
    expect(ui.groupedView.query()).not.toBeInTheDocument();
  });

  it('should show grouped view when view parameter is empty', () => {
    render(<RuleList />, { historyOptions: { initialEntries: ['/?view='] } });

    expect(ui.groupedView.get()).toBeInTheDocument();
    expect(ui.filterView.query()).not.toBeInTheDocument();
  });

  it('should show grouped view when search parameter is empty', () => {
    render(<RuleList />, { historyOptions: { initialEntries: ['/?search='] } });

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
    render(<RuleList />, { historyOptions: { initialEntries: [`/?search=${encodeURIComponent(searchQuery)}`] } });

    expect(ui.filterView.get()).toBeInTheDocument();
    expect(ui.groupedView.query()).not.toBeInTheDocument();
  });

  it('should show list view when "view=list" URL parameter is present with group filter', () => {
    render(<RuleList />, { historyOptions: { initialEntries: ['/?view=list&search=group:cpu-usage'] } });

    expect(ui.filterView.get()).toBeInTheDocument();
    expect(ui.groupedView.query()).not.toBeInTheDocument();
  });

  it('should show list view when "view=list" URL parameter is present with namespace filter', () => {
    render(<RuleList />, { historyOptions: { initialEntries: ['/?view=list&search=namespace:global'] } });

    expect(ui.filterView.get()).toBeInTheDocument();
    expect(ui.groupedView.query()).not.toBeInTheDocument();
  });

  it('should show list view when "view=list" URL parameter is present with both group and namespace filters', () => {
    render(<RuleList />, {
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
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
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
});

describe('RuleList v2 - View switching', () => {
  it('should preserve both group and namespace filters when switching from list view to grouped view', async () => {
    // Start with list view and both group and namespace filters
    const { user } = render(<RuleList />, {
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
    const { user } = render(<RuleList />, {
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
