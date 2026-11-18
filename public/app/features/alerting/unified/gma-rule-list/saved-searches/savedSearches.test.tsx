import { render, screen, waitFor, within } from 'test/test-utils';
import { byPlaceholderText, byRole } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';

import { setupMswServer } from '../../mockApi';
import AlertRulesPage from '../alert-rules/AlertRulesPage';
import { alertRuleFactory, folderFactory, recordingRuleFactory } from '../mocks/factories';
import { setupRuleListBackend } from '../mocks/ruleListBackend';
import RecordingRulesPage from '../recording-rules/RecordingRulesPage';

setupMswServer();

const ui = {
  searchInput: byRole('textbox', { name: 'Search' }),
  savedSearchesButton: byRole('button', { name: 'Saved searches' }),
  saveCurrentSearch: byRole('button', { name: /save current search/i }),
  saveNameInput: byPlaceholderText(/enter a name/i),
  saveConfirm: byRole('button', { name: /^save$/i }),
  savedSearchesList: byRole('list', { name: 'Saved searches list' }),
};

const FOLDERS = [folderFactory.build({ metadata: { name: 'folder-1' }, spec: { title: 'Team Alerts' } })];

function setupBackend() {
  setupRuleListBackend({
    folders: FOLDERS,
    alertRules: [
      alertRuleFactory.inFolder('folder-1').build({ spec: { title: 'CPU high load' } }),
      alertRuleFactory.inFolder('folder-1').build({ spec: { title: 'Disk full' } }),
    ],
    recordingRules: [
      recordingRuleFactory.inFolder('folder-1').build({ spec: { title: 'CPU usage ratio' } }),
      recordingRuleFactory.inFolder('folder-1').build({ spec: { title: 'Disk usage ratio' } }),
    ],
  });
}

function saveCollection(
  storageKey: string,
  searches: Array<{ id: string; name: string; query: string; isDefault: boolean }>
) {
  return new UserStorage('alerting').setItem(storageKey, JSON.stringify(searches));
}

function searchParam() {
  return new URLSearchParams(locationService.getLocation().search).get('search');
}

function renderAlertRules(url: string) {
  return render(<AlertRulesPage />, { historyOptions: { initialEntries: [url] } });
}

describe('GMA rule list saved searches', () => {
  beforeEach(() => {
    localStorage.clear();
    setupBackend();
  });

  it('applies the default saved search when the page opens without a search parameter', async () => {
    await saveCollection('alertRulesSavedSearches', [{ id: '1', name: 'Busy CPUs', query: 'cpu', isDefault: true }]);

    renderAlertRules('/?view=list');

    expect(await screen.findByRole('link', { name: 'CPU high load' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Disk full' })).not.toBeInTheDocument();
    expect(ui.searchInput.get()).toHaveValue('cpu');
    expect(searchParam()).toBe('cpu');
  });

  it('keeps an empty search parameter unfiltered instead of applying the default', async () => {
    await saveCollection('alertRulesSavedSearches', [{ id: '1', name: 'Busy CPUs', query: 'cpu', isDefault: true }]);

    renderAlertRules('/?view=list&search=');

    expect(await screen.findByRole('link', { name: 'Disk full' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CPU high load' })).toBeInTheDocument();
    expect(ui.searchInput.get()).toHaveValue('');
  });

  it('keeps the query from the URL instead of applying the default', async () => {
    await saveCollection('alertRulesSavedSearches', [{ id: '1', name: 'Busy CPUs', query: 'cpu', isDefault: true }]);

    renderAlertRules('/?view=list&search=disk');

    expect(await screen.findByRole('link', { name: 'Disk full' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'CPU high load' })).not.toBeInTheDocument();
    expect(ui.searchInput.get()).toHaveValue('disk');
  });

  it('applies a saved search from the menu', async () => {
    await saveCollection('alertRulesSavedSearches', [{ id: '1', name: 'Full disks', query: 'disk', isDefault: false }]);
    const { user } = renderAlertRules('/?view=list');
    await screen.findByRole('link', { name: 'CPU high load' });

    await user.click(ui.savedSearchesButton.get());
    await user.click(await screen.findByRole('link', { name: 'Full disks' }));

    await waitFor(() => expect(searchParam()).toBe('disk'));
    expect(screen.queryByRole('link', { name: 'CPU high load' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Disk full' })).toBeInTheDocument();
    expect(ui.searchInput.get()).toHaveValue('disk');
  });

  it('keeps the Alert and Recording collections apart', async () => {
    const { user, unmount } = renderAlertRules('/?view=list&search=cpu');
    await screen.findByRole('link', { name: 'CPU high load' });

    await user.click(ui.savedSearchesButton.get());
    await user.click(await ui.saveCurrentSearch.find());
    await user.type(await ui.saveNameInput.find(), 'CPU alerts');
    await user.click(ui.saveConfirm.get());

    expect(await within(ui.savedSearchesList.get()).findByRole('link', { name: 'CPU alerts' })).toBeInTheDocument();
    unmount();

    const view = render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });
    await screen.findByRole('link', { name: 'CPU usage ratio' });
    await view.user.click(ui.savedSearchesButton.get());

    expect(await screen.findByText(/no saved searches yet/i)).toBeInTheDocument();
  });

  it("applies the Recording rules page's own default, not the Alert rules one", async () => {
    await saveCollection('alertRulesSavedSearches', [{ id: '1', name: 'Busy CPUs', query: 'cpu', isDefault: true }]);
    await saveCollection('recordingRulesSavedSearches', [
      { id: '2', name: 'Disk ratios', query: 'disk', isDefault: true },
    ]);

    render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByRole('link', { name: 'Disk usage ratio' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'CPU usage ratio' })).not.toBeInTheDocument();
  });
});
