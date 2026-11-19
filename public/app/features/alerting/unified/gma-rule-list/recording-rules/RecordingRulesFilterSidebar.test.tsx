import { render, screen, waitFor, within } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';

import { setupMswServer } from '../../mockApi';
import { setupDataSources } from '../../testSetup/datasources';
import { mockDataSource } from '../../testSetup/mockDataSource';
import { folderFactory, recordingRuleFactory } from '../mocks/factories';
import { setupRuleListBackend } from '../mocks/ruleListBackend';

import RecordingRulesPage from './RecordingRulesPage';

setupMswServer();
setupDataSources(
  mockDataSource({ uid: 'mimir-uid', name: 'Mimir' }, { alerting: true }),
  mockDataSource({ uid: 'loki-uid', name: 'Loki logs', type: 'loki' }, { alerting: true })
);

beforeEach(() => {
  setupRuleListBackend({
    folders: [folderFactory.build({ metadata: { name: 'folder-1' }, spec: { title: 'Team Metrics' } })],
    recordingRules: [recordingRuleFactory.inFolder('folder-1').build({ spec: { title: 'cpu:usage:rate5m' } })],
  });
});

function renderPage(search: string) {
  return render(<RecordingRulesPage />, { historyOptions: { initialEntries: [`/?${new URLSearchParams({ search })}`] } });
}

function searchParam() {
  return new URLSearchParams(locationService.getLocation().search).get('search');
}

describe('RecordingRulesFilterSidebar', () => {
  it('shows each filter of the query in its control', async () => {
    renderPage('cpu metric:cpu_usage targetDatasource:mimir-uid health:error');

    expect(await screen.findByRole('textbox', { name: 'Rule name' })).toHaveValue('cpu');
    expect(screen.getByRole('textbox', { name: 'Recorded metric' })).toHaveValue('cpu_usage');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Target data source' })).toHaveValue('Mimir'));
    expect(within(screen.getByRole('radiogroup', { name: 'Health' })).getByRole('radio', { name: 'Error' })).toBeChecked();
  });

  it('applies the recorded metric on blur', async () => {
    const { user } = renderPage('cpu');

    await user.type(await screen.findByRole('textbox', { name: 'Recorded metric' }), 'cpu_usage');
    expect(searchParam()).toBe('cpu');
    await user.tab();

    await waitFor(() => expect(searchParam()).toBe('cpu metric:cpu_usage'));
  });

  it('offers only valid recording targets, and adds a picked one to the query', async () => {
    mockComboboxRect();
    const { user } = renderPage('cpu');

    await user.click(await screen.findByRole('combobox', { name: 'Target data source' }));
    const mimir = await screen.findByRole('option', { name: 'Mimir' });
    expect(screen.queryByRole('option', { name: 'Loki logs' })).not.toBeInTheDocument();
    await user.click(mimir);

    await waitFor(() => expect(searchParam()).toBe('cpu targetDatasource:mimir-uid'));
  });

  it('shows an unknown target data source by its UID', async () => {
    renderPage('targetDatasource:gone-uid');

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Target data source' })).toHaveValue('gone-uid'));
  });
});
