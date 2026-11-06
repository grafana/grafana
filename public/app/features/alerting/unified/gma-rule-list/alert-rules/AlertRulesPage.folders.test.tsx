import { act, render, screen, waitFor } from 'test/test-utils';

import * as runtime from '@grafana/runtime';

import { setupMswServer } from '../../mockApi';
import { installControllableIntersectionObserver } from '../../mocks/intersectionObserver';
import { alertRuleFactory, folderFactory, recordingRuleFactory } from '../mocks/factories';
import { setupRuleListBackend } from '../mocks/ruleListBackend';

import AlertRulesPage from './AlertRulesPage';

setupMswServer();

const FOLDERS = [
  folderFactory.build({ metadata: { name: 'team' }, spec: { title: 'Team Alerts' } }),
  folderFactory.build({ metadata: { name: 'platform' }, spec: { title: 'Platform' } }),
  folderFactory.inFolder('platform').build({ metadata: { name: 'infra' }, spec: { title: 'Infra' } }),
  folderFactory.build({ metadata: { name: 'metrics' }, spec: { title: 'Metrics' } }),
];

const ALERT_RULES = [
  alertRuleFactory.inFolder('team').build({ spec: { title: 'CPU high' } }),
  alertRuleFactory.inFolder('team').build({ spec: { title: 'Disk full' } }),
  alertRuleFactory.inFolder('team').build({ spec: { title: 'Memory high' } }),
  alertRuleFactory.inFolder('infra').build({ spec: { title: 'Latency' } }),
];

// Folder search lists folders holding rules of either kind, so Metrics is listed with no Alert rules.
const RECORDING_RULES = [recordingRuleFactory.inFolder('metrics').build({ spec: { title: 'request_rate' } })];

function setup(options: Partial<Parameters<typeof setupRuleListBackend>[0]> = {}) {
  return setupRuleListBackend({
    folders: FOLDERS,
    alertRules: ALERT_RULES,
    recordingRules: RECORDING_RULES,
    ...options,
  });
}

function viewParam() {
  return new URLSearchParams(runtime.locationService.getLocation().search).get('view');
}

function folderToggles() {
  return screen
    .getAllByRole('button', { name: /^(Expand|Collapse) / })
    .map((button) => button.getAttribute('aria-label'));
}

describe('AlertRulesPage Folders mode', () => {
  let intersection: ReturnType<typeof installControllableIntersectionObserver>;
  let reportInteraction: jest.SpyInstance;

  beforeEach(() => {
    intersection = installControllableIntersectionObserver();
    reportInteraction = jest.spyOn(runtime, 'reportInteraction').mockImplementation(() => {});
  });

  afterEach(() => {
    intersection.restore();
    reportInteraction.mockRestore();
  });

  it('opens in Folders mode with collapsed folders holding rules, in title order, each with its direct Alert-rule count', async () => {
    const backend = setup();

    render(<AlertRulesPage />);

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toHaveAttribute(
      'href',
      '/dashboards/f/team/team-alerts/alerting'
    );
    expect(folderToggles()).toEqual(['Expand Infra', 'Expand Metrics', 'Expand Team Alerts']);
    expect(await screen.findByText('3 alert rules')).toBeInTheDocument();
    expect(await screen.findByText('1 alert rule')).toBeInTheDocument();
    expect(await screen.findByText('0 alert rules')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(backend.folderSearches).toEqual([
      expect.objectContaining({
        labelSelector: { matchLabels: { 'alerting.grafana.app/has-rules': 'true' } },
        sort: [{ field: 'title', direction: 'asc' }],
        limit: 40,
      }),
    ]);
    expect(backend.folderSearches[0]).not.toHaveProperty('where');
    expect(backend.ruleSearches).toEqual([]);
    expect(reportInteraction).toHaveBeenCalledWith('grafana_alerting_gma_rule_list_view', {
      kind: 'alert',
      mode: 'folders',
    });
  });

  it('shows the parent path of a nested folder', async () => {
    setup();

    render(<AlertRulesPage />);

    expect(await screen.findByText('Platform')).toBeInTheDocument();
  });

  it('scopes the folder listing to a folder filter and stays in Folders mode', async () => {
    const backend = setup();

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?search=folder%3Ateam'] } });

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(folderToggles()).toEqual(['Expand Team Alerts']);
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(backend.folderSearches[0].where).toEqual({ filter: { field: 'name', operator: 'In', values: ['team'] } });
    expect(backend.ruleSearches).toEqual([]);
  });

  it('loads only the expanded folder rules, without a folder path on their rows', async () => {
    const backend = setup();
    const { user } = render(<AlertRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Alerts' }));

    const ruleLink = await screen.findByRole('link', { name: 'CPU high' });
    expect(screen.getByRole('link', { name: 'Disk full' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Memory high' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Latency' })).not.toBeInTheDocument();
    expect(backend.ruleSearches.map((body) => body.where)).toEqual([
      { filter: { field: 'folder', operator: 'In', values: ['team'] } },
    ]);
    // The folder row already names the folder, so the rule row has no path of its own.
    expect(ruleLink.closest('li')).not.toHaveTextContent('Team Alerts');

    await user.click(screen.getByRole('button', { name: 'Collapse Team Alerts' }));

    expect(screen.queryByRole('link', { name: 'CPU high' })).not.toBeInTheDocument();
  });

  it('keeps a separate Load more for each expanded folder', async () => {
    const backend = setup({ pageSize: { rules: 2 } });
    const { user } = render(<AlertRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Alerts' }));
    await user.click(screen.getByRole('button', { name: 'Expand Infra' }));
    expect(await screen.findByRole('link', { name: 'Latency' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Disk full' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Memory high' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more rules in Infra' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more rules in Team Alerts' }));

    expect(await screen.findByRole('link', { name: 'Memory high' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Latency' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();
    expect(backend.ruleSearches.filter((body) => body.continue)).toHaveLength(1);
  });

  it('loads the next page of folders when the end of the list comes into view, keeping the loaded ones, until the last page', async () => {
    const backend = setup({ pageSize: { folders: 2 } });
    render(<AlertRulesPage />);

    expect(await screen.findByRole('link', { name: 'Metrics' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Team Alerts' })).not.toBeInTheDocument();

    intersection.intersectObserved();

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(folderToggles()).toEqual(['Expand Infra', 'Expand Metrics', 'Expand Team Alerts']);
    expect(backend.folderSearches).toHaveLength(2);
    expect(screen.queryByTestId('load-more-helper')).not.toBeInTheDocument();
  });

  it('keeps the loaded folders when the next page fails, does not retry on its own, and loads it after Retry', async () => {
    const backend = setup({ pageSize: { folders: 2 } });
    backend.failNext('folderSearch', { continued: true, status: 410 });
    const { user } = render(<AlertRulesPage />);
    await screen.findByRole('link', { name: 'Metrics' });

    intersection.intersectObserved();

    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Infra' })).toBeInTheDocument();
    expect(screen.queryByTestId('load-more-helper')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    // The helper is back once the refetch of every loaded page is done.
    expect(await screen.findByTestId('load-more-helper')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load more results')).not.toBeInTheDocument();
    intersection.intersectObserved();
    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
  });

  it('does not watch the end of the list while Retry reloads the loaded pages', async () => {
    const backend = setup({ pageSize: { folders: 2 } });
    backend.failNext('folderSearch', { continued: true });
    const { user } = render(<AlertRulesPage />);
    await screen.findByRole('link', { name: 'Metrics' });
    intersection.intersectObserved();
    const retry = await screen.findByRole('button', { name: 'Retry' });
    const releaseReload = backend.holdNext('folderSearch', { continued: false });

    await user.click(retry);
    await waitFor(() => expect(backend.folderSearches).toHaveLength(3));

    expect(screen.queryByTestId('load-more-helper')).not.toBeInTheDocument();

    releaseReload();

    expect(await screen.findByTestId('load-more-helper')).toBeInTheDocument();
  });

  it('switches to List for free text, keeps the folder filter, and disables Folders until it is cleared', async () => {
    const backend = setup();
    const { user } = render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?search=folder%3Ateam'] } });
    await screen.findByRole('link', { name: 'Team Alerts' });

    await user.type(screen.getByRole('textbox', { name: 'Search' }), ' cpu{Enter}');

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Disk full' })).not.toBeInTheDocument();
    // A non-folder filter forces List on its own; `view` keeps only a mode the user chose.
    expect(viewParam()).toBeNull();
    expect(backend.ruleSearches.at(-1)?.where).toEqual({
      and: [{ text: { value: 'cpu' } }, { filter: { field: 'folder', operator: 'In', values: ['team'] } }],
    });
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Folders' })).toHaveAccessibleDescription(
      'Clear filters to browse by folder'
    );

    await user.hover(screen.getByText('Folders'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Clear filters to browse by folder');
  });

  it('switches between Folders and List with the toggle, writing the view to the URL', async () => {
    const backend = setup();
    const { user } = render(<AlertRulesPage />);
    await screen.findByRole('link', { name: 'Team Alerts' });

    await user.click(screen.getByRole('radio', { name: 'List' }));

    expect(await screen.findByRole('link', { name: 'Latency' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(viewParam()).toBe('list');
    expect(backend.ruleSearches.map((body) => body.where)).toEqual([undefined]);

    await user.click(screen.getByRole('radio', { name: 'Folders' }));

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(viewParam()).toBeNull();
  });

  it('shows a message for an expanded folder that has no Alert rules', async () => {
    setup();
    const { user } = render(<AlertRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Metrics' }));

    expect(await screen.findByText('No alert rules in this folder')).toBeInTheDocument();
  });

  it('exposes the loading rules of an expanded folder as a busy list', async () => {
    const backend = setup();
    const releaseRules = backend.holdNext('ruleSearch');
    const { user } = render(<AlertRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Alerts' }));

    expect(await screen.findByRole('list', { name: 'Loading rules' })).toHaveAttribute('aria-busy', 'true');
    releaseRules();
    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Loading rules' })).not.toBeInTheDocument();
  });

  it('shows a folder title with special characters as typed in its labels', async () => {
    setup({
      folders: [folderFactory.build({ metadata: { name: 'rnd' }, spec: { title: 'R&D <ops>' } })],
      alertRules: alertRuleFactory.inFolder('rnd').buildList(2),
      pageSize: { rules: 1 },
    });
    const { user } = render(<AlertRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand R&D <ops>' }));

    expect(await screen.findByRole('button', { name: 'Load more rules in R&D <ops>' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse R&D <ops>' })).toBeInTheDocument();
  });

  it('shows an expanded folder rule search failure with Retry, and the rules after Retry', async () => {
    const backend = setup();
    backend.failNext('ruleSearch');
    const { user } = render(<AlertRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Alerts' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load rules');

    await user.click(screen.getByRole('button', { name: 'Retry loading rules in Team Alerts' }));

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText('Failed to load rules')).not.toBeInTheDocument();
  });

  it('keeps an expanded folder open, with its rules and no new rule search, when the folder list loads its next page', async () => {
    const backend = setup({ pageSize: { folders: 2 } });
    const { user } = render(<AlertRulesPage />);
    await user.click(await screen.findByRole('button', { name: 'Expand Infra' }));
    const ruleLink = await screen.findByRole('link', { name: 'Latency' });
    expect(backend.ruleSearches).toHaveLength(1);

    intersection.intersectObserved();

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Infra' })).toHaveAttribute('aria-expanded', 'true');
    // The same node, so the folder was not remounted and its rules were not fetched again.
    expect(ruleLink).toBeInTheDocument();
    expect(backend.ruleSearches).toHaveLength(1);
  });

  it('restarts the folder list from the first page, collapsed, when the folder filter changes', async () => {
    const backend = setup({ pageSize: { folders: 1 } });
    const { user } = render(<AlertRulesPage />, {
      historyOptions: { initialEntries: [`/?${new URLSearchParams({ search: 'folder:infra folder:team' })}`] },
    });
    await user.click(await screen.findByRole('button', { name: 'Expand Infra' }));
    await screen.findByRole('link', { name: 'Latency' });
    intersection.intersectObserved();
    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();

    await user.tripleClick(screen.getByRole('textbox', { name: 'Search' }));
    await user.keyboard('folder:infra{Enter}');

    await waitFor(() => expect(backend.folderSearches.map((body) => body.continue ?? null)).toEqual([null, '1', null]));
    // The same folder reappears under the new filter, but no longer expanded.
    expect(await screen.findByRole('button', { name: 'Expand Infra' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Team Alerts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Latency' })).not.toBeInTheDocument();
  });

  it('Back and Forward restore Folders and List as the view changes', async () => {
    setup();
    const { user } = render(<AlertRulesPage />);
    await screen.findByRole('link', { name: 'Team Alerts' });
    await user.click(screen.getByRole('radio', { name: 'List' }));
    await screen.findByRole('link', { name: 'CPU high' });

    act(() => runtime.locationService.getHistory().goBack());

    expect(await screen.findByRole('button', { name: 'Expand Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(viewParam()).toBeNull();

    act(() => runtime.locationService.getHistory().goForward());

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
    expect(viewParam()).toBe('list');
  });

  it('shows loading rows and no end-of-list helper while the next page of folders loads', async () => {
    const backend = setup({ pageSize: { folders: 1 } });
    render(<AlertRulesPage />);
    await screen.findByRole('link', { name: 'Infra' });
    const releasePage = backend.holdNext('folderSearch', { continued: true });

    intersection.intersectObserved();

    expect(await screen.findByRole('list', { name: 'Loading rules' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('load-more-helper')).not.toBeInTheDocument();

    releasePage();

    expect(await screen.findByRole('link', { name: 'Metrics' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Loading rules' })).not.toBeInTheDocument();
    expect(screen.getByTestId('load-more-helper')).toBeInTheDocument();
  });
});
