import { render, screen, waitFor, within } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { setupDataSources } from '../../testSetup/datasources';
import { mockDataSource } from '../../testSetup/mockDataSource';
import { alertRuleFactory, folderFactory } from '../mocks/factories';
import { setupRuleListBackend } from '../mocks/ruleListBackend';

import AlertRulesPage from './AlertRulesPage';

setupMswServer();
setupDataSources(mockDataSource({ uid: 'prom-uid', name: 'Prometheus main' }, { alerting: true }));

// The sidebar shows beside the rules from the lg breakpoint; jsdom's matchMedia never matches.
const jsdomMatchMedia = window.matchMedia;
function setWideScreen(isWide: boolean) {
  jest.spyOn(window, 'matchMedia').mockImplementation((query) => ({ ...jsdomMatchMedia(query), matches: isWide }));
}

beforeEach(() => {
  setWideScreen(true);
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
  it('folds the filters above the rules on a narrow screen, until opened', async () => {
    setWideScreen(false);
    const { user } = renderPage('cpu');

    expect(await screen.findByRole('link', { name: 'CPU high load' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Rule name' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filters' }));

    expect(screen.getByRole('textbox', { name: 'Rule name' })).toHaveValue('cpu');
  });

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
    const values = screen.getAllByRole('textbox', { name: 'Label value' });
    expect(values[0]).toHaveValue('api');
    expect(values[1]).toBeDisabled();
    expect(values[1]).toHaveAttribute('placeholder', 'none');
  });

  it.each([
    ['prom-uid', 'Prometheus main'],
    ['ds-unknown', 'ds-unknown'],
  ])('shows the data source %s as %s', async (uid, shown) => {
    renderPage(`datasource:${uid}`);

    expect(await screen.findByText(shown)).toBeInTheDocument();
  });

  it('offers only named notification policies, and adds a picked one to the query', async () => {
    mockComboboxRect();
    const { user } = renderPage('cpu');

    await user.click(await screen.findByRole('combobox', { name: /Notification policy/ }));
    const named = await screen.findByRole('option', { name: /Managed Policy - Empty Provisioned/ });
    expect(screen.queryByRole('option', { name: /Default policy/ })).not.toBeInTheDocument();
    await user.click(named);

    await waitFor(() => expect(searchParam()).toBe('cpu policy:"Managed Policy - Empty Provisioned"'));
  });

  it('shows the folders of the query by title in one picker, and adds a picked folder to the query', async () => {
    server.use(
      getCustomSearchHandler([
        { resource: 'folders', name: 'folder-1', title: 'Team Alerts' },
        { resource: 'folders', name: 'folder-2', title: 'Payments' },
      ])
    );
    mockComboboxRect();
    const { user } = renderPage('cpu folderUid:folder-1');
    const folders = await screen.findByRole('combobox', { name: 'Folder' });

    await waitFor(() => expect(folders.closest('div')?.parentElement).toHaveTextContent('Team Alerts'));

    await user.click(folders);
    await user.click(await screen.findByRole('option', { name: 'Payments' }));

    await waitFor(() => expect(searchParam()).toBe('cpu folderUid:folder-1 folderUid:folder-2'));
  });

  it('rewrites only the changed filter, keeping the rest of the query in order', async () => {
    const { user } = renderPage('cpu state:firing label:team=api');

    await user.click(
      within(await screen.findByRole('radiogroup', { name: 'Alert state' })).getByRole('radio', { name: 'Pending' })
    );

    await waitFor(() => expect(searchParam()).toBe('cpu state:pending label:team=api'));
    expect(searchInput()).toHaveValue('cpu state:pending label:team=api');
  });

  it('names the dashboard picker by its label', async () => {
    renderPage('');

    expect(await screen.findByRole('combobox', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('keeps the help icon out of the label, so it is not part of the field name', async () => {
    renderPage('');

    expect((await screen.findByTitle('Folder filter help')).closest('label')).toBeNull();
  });

  it('moves focus with the arrow keys and picks with Space, from a single tab stop on the checked option', async () => {
    const { user } = renderPage('cpu');
    const health = await screen.findByRole('radiogroup', { name: 'Health' });
    const radio = (name: string) => within(health).getByRole('radio', { name });
    const tabStops = () =>
      within(health)
        .getAllByRole('radio')
        .filter((option) => option.tabIndex === 0);
    expect(tabStops()).toEqual([radio('All')]);

    radio('All').focus();
    await user.keyboard('{ArrowUp}');
    expect(radio('Unknown')).toHaveFocus();
    expect(searchParam()).toBe('cpu');

    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(radio('OK')).toHaveFocus();
    await user.keyboard(' ');

    await waitFor(() => expect(searchParam()).toBe('cpu health:ok'));
    expect(tabStops()).toEqual([radio('OK')]);
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
