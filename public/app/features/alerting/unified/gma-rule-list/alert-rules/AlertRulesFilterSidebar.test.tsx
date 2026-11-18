import { render, screen, waitFor, within } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { setupMswServer } from '../../mockApi';
import { setupDataSources } from '../../testSetup/datasources';
import { mockDataSource } from '../../testSetup/mockDataSource';
import { alertRuleFactory, folderFactory } from '../mocks/factories';
import { setupRuleListBackend } from '../mocks/ruleListBackend';

import AlertRulesPage from './AlertRulesPage';

setupMswServer();
setupDataSources(mockDataSource({ uid: 'prom-uid', name: 'Prometheus main' }, { alerting: true }));

beforeEach(() => {
  setupRuleListBackend({
    folders: [folderFactory.build({ metadata: { name: 'folder-1' }, spec: { title: 'Team Alerts' } })],
    alertRules: [alertRuleFactory.inFolder('folder-1').build({ spec: { title: 'CPU high load' } })],
  });
});

function renderPage(search: string) {
  return render(<AlertRulesPage />, { historyOptions: { initialEntries: [`/?${new URLSearchParams({ search })}`] } });
}

function searchParam() {
  return new URLSearchParams(locationService.getLocation().search).get('search');
}

function searchInput() {
  return screen.getByRole('textbox', { name: 'Search' });
}

function group(name: string) {
  return screen.getByRole('radiogroup', { name });
}

describe('AlertRulesFilterSidebar', () => {
  it('shows each filter of the query in its control', async () => {
    renderPage('cpu state:firing label:team=api label:!env paused:true plugins:hide');

    expect(await screen.findByRole('textbox', { name: 'Rule name' })).toHaveValue('cpu');
    expect(within(group('Alert state')).getByRole('radio', { name: 'Firing' })).toBeChecked();
    expect(within(group('Health')).getByRole('radio', { name: 'All' })).toBeChecked();
    expect(within(group('Paused')).getByRole('radio', { name: 'Paused' })).toBeChecked();
    expect(within(group('Plugin rules')).getByRole('radio', { name: 'Hide' })).toBeChecked();

    const keys = screen.getAllByRole('textbox', { name: 'Label key' });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toHaveValue('team');
    expect(keys[1]).toHaveValue('env');
    expect(screen.getByRole('textbox', { name: 'Label value' })).toHaveValue('api');
  });

  it.each([
    ['prom-uid', 'Prometheus main'],
    ['ds-unknown', 'ds-unknown'],
  ])('shows the data source %s as %s', async (uid, shown) => {
    renderPage(`datasource:${uid}`);

    expect(await screen.findByText(shown)).toBeInTheDocument();
  });

  it('rewrites only the changed filter, keeping the rest of the query in order', async () => {
    const { user } = renderPage('cpu state:firing label:team=api');

    await user.click(
      within(await screen.findByRole('radiogroup', { name: 'Alert state' })).getByRole('radio', { name: 'Pending' })
    );

    await waitFor(() => expect(searchParam()).toBe('cpu state:pending label:team=api'));
    expect(searchInput()).toHaveValue('cpu state:pending label:team=api');
  });

  it('applies the rule name on blur, replacing only the title text', async () => {
    const { user } = renderPage('cpu state:firing');
    const ruleName = await screen.findByRole('textbox', { name: 'Rule name' });

    await user.clear(ruleName);
    await user.type(ruleName, 'disk full');
    expect(searchParam()).toBe('cpu state:firing');
    await user.tab();

    await waitFor(() => expect(searchParam()).toBe('disk full state:firing'));
  });

  it('sends a label row only once it has a key and a value', async () => {
    const { user } = renderPage('cpu');
    await user.click(await screen.findByRole('button', { name: 'Add label' }));

    await user.type(screen.getByRole('textbox', { name: 'Label key' }), 'team{Enter}');
    expect(searchParam()).toBe('cpu');

    await user.type(screen.getByRole('textbox', { name: 'Label value' }), 'a b{Enter}');
    await waitFor(() => expect(searchParam()).toBe('cpu label:"team=a b"'));
    // The incomplete row stays, so a second matcher can be added while the first one applies.
    expect(screen.getByRole('textbox', { name: 'Label key' })).toHaveValue('team');
  });

  it('follows a query typed into the search box', async () => {
    const { user } = renderPage('state:firing');
    await screen.findByRole('textbox', { name: 'Rule name' });

    await user.clear(searchInput());
    await user.type(searchInput(), 'memory health:error{Enter}');

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Rule name' })).toHaveValue('memory'));
    expect(within(group('Alert state')).getByRole('radio', { name: 'All' })).toBeChecked();
    expect(within(group('Health')).getByRole('radio', { name: 'Error' })).toBeChecked();
  });

  it('empties the dashboard and its panel ID when the search input is cleared', async () => {
    const { user } = renderPage('dashboard:dash-1 panelId:4');
    expect(await screen.findByRole('textbox', { name: 'Panel ID' })).toHaveValue('4');

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(searchParam()).toBe(''));
    expect(screen.queryByRole('textbox', { name: 'Panel ID' })).not.toBeInTheDocument();
    expect(screen.queryByText(/dash-1/)).not.toBeInTheDocument();
  });

  it('empties every control when the search input is cleared, and stays shown in Folders mode', async () => {
    const { user } = renderPage('cpu state:firing');

    await user.click(await screen.findByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(searchParam()).toBe(''));
    expect(searchInput()).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Rule name' })).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
  });
});
