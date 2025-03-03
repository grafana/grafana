import { render } from 'test/test-utils';
import { byTestId } from 'testing-library-selector';

import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { alertingFactory } from '../mocks/server/db';

import RuleList from './RuleList.v2';

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
