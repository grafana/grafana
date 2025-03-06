import { render } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { alertingFactory } from '../mocks/server/db';

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
};

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);

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

  it('should show list view when a filter is applied', () => {
    render(<RuleList />, { historyOptions: { initialEntries: ['/?search=rule:cpu-alert'] } });

    expect(ui.filterView.get()).toBeInTheDocument();
    expect(ui.groupedView.query()).not.toBeInTheDocument();
  });
});

describe('RuleListActions', () => {
  const ui = {
    newRuleButton: byRole('link', { name: /new alert rule/i }),
    moreButton: byRole('button', { name: /more/i }),
    moreMenu: byRole('menu'),
    menuOptions: {
      draftNewRule: byRole('link', { name: /draft a new rule/i }),
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

  it('should only show Draft a new rule when the user has view Grafana rules permission', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);

    const { user } = render(<RuleListActions />);

    await user.click(ui.moreButton.get());
    const menu = await ui.moreMenu.find();

    expect(ui.newRuleButton.query()).not.toBeInTheDocument();
    expect(ui.menuOptions.draftNewRule.query(menu)).toBeInTheDocument();
    expect(ui.menuOptions.newGrafanaRecordingRule.query(menu)).not.toBeInTheDocument();
    expect(ui.menuOptions.newDataSourceRecordingRule.query(menu)).not.toBeInTheDocument();
  });

  it('should show "New Grafana recording rule" option when user has Grafana rule permissions', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);

    const { user } = render(<RuleListActions />);

    await user.click(ui.moreButton.get());
    const menu = await ui.moreMenu.find();

    expect(ui.menuOptions.draftNewRule.query(menu)).toBeInTheDocument();
    expect(ui.menuOptions.newGrafanaRecordingRule.query(menu)).toBeInTheDocument();
    expect(ui.menuOptions.newDataSourceRecordingRule.query(menu)).not.toBeInTheDocument();
  });

  it('should show "New Data source recording rule" option when user has external rule permissions', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleExternalWrite]);

    const { user } = render(<RuleListActions />);

    await user.click(ui.moreButton.get());
    const menu = await ui.moreMenu.find();

    expect(ui.menuOptions.draftNewRule.query(menu)).toBeInTheDocument();
    expect(ui.menuOptions.newGrafanaRecordingRule.query(menu)).not.toBeInTheDocument();
    expect(ui.menuOptions.newDataSourceRecordingRule.query(menu)).toBeInTheDocument();
  });

  it('should show both recording rule options when user has all permissions', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingRuleExternalWrite]);

    const { user } = render(<RuleListActions />);

    await user.click(ui.moreButton.get());
    const menu = await ui.moreMenu.find();

    expect(ui.menuOptions.draftNewRule.query(menu)).toBeInTheDocument();
    expect(ui.menuOptions.newGrafanaRecordingRule.query(menu)).toBeInTheDocument();
    expect(ui.menuOptions.newDataSourceRecordingRule.query(menu)).toBeInTheDocument();
  });
});
