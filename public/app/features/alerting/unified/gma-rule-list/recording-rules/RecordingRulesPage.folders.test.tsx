import { act, render, screen, within } from 'test/test-utils';

import * as runtime from '@grafana/runtime';

import { setupMswServer } from '../../mockApi';
import { installControllableIntersectionObserver } from '../../mocks/intersectionObserver';
import { alertRuleFactory, folderFactory, recordingRuleFactory } from '../mocks/factories';
import { setupRuleListBackend } from '../mocks/ruleListBackend';

import RecordingRulesPage from './RecordingRulesPage';

setupMswServer();

const FOLDERS = [
  folderFactory.build({ metadata: { name: 'team' }, spec: { title: 'Team Metrics' } }),
  folderFactory.build({ metadata: { name: 'platform' }, spec: { title: 'Platform' } }),
  folderFactory.inFolder('platform').build({ metadata: { name: 'infra' }, spec: { title: 'Infra' } }),
  folderFactory.build({ metadata: { name: 'alerts' }, spec: { title: 'Zeta Alerts' } }),
];

const RECORDING_RULES = [
  recordingRuleFactory.inFolder('team').build({ spec: { title: 'cpu:usage:rate5m' } }),
  recordingRuleFactory.inFolder('team').build({ spec: { title: 'disk:usage:rate5m' } }),
  recordingRuleFactory.inFolder('team').build({ spec: { title: 'mem:usage:rate5m' } }),
  recordingRuleFactory.inFolder('infra').build({ spec: { title: 'latency:p99' } }),
];

// Folder search lists folders holding rules of either kind, so Zeta Alerts is listed with no Recording rules.
const ALERT_RULES = [alertRuleFactory.inFolder('alerts').build({ spec: { title: 'CPU high' } })];

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

async function findFolderRow(title: string) {
  const row = (await screen.findByRole('link', { name: title })).closest('li');
  if (!row) {
    throw new Error(`No row for folder ${title}`);
  }
  return row;
}

function folderToggles() {
  return screen
    .getAllByRole('button', { name: /^(Expand|Collapse) / })
    .map((button) => button.getAttribute('aria-label'));
}

describe('RecordingRulesPage Folders mode', () => {
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

  it('opens in Folders mode with collapsed folder rows, in the order the search returns them', async () => {
    setup();

    render(<RecordingRulesPage />);

    expect(await screen.findByRole('link', { name: 'Team Metrics' })).toHaveAttribute(
      'href',
      '/dashboards/f/team/team-metrics/alerting'
    );
    expect(folderToggles()).toEqual(['Expand Infra', 'Expand Team Metrics', 'Expand Zeta Alerts']);
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(reportInteraction).toHaveBeenCalledWith('grafana_alerting_gma_rule_list_view', {
      kind: 'recording',
      mode: 'folders',
    });
  });

  it.each([
    { title: 'Team Metrics', count: '3 recording rules' },
    { title: 'Infra', count: '1 recording rule' },
    { title: 'Zeta Alerts', count: '0 recording rules' },
  ])('shows $count on the $title row', async ({ title, count }) => {
    setup();

    render(<RecordingRulesPage />);

    const row = await findFolderRow(title);
    expect(await within(row).findByRole('img', { name: new RegExp(`^${count}\\.`) })).toBeInTheDocument();
  });

  it('shows the parent on the nested folder row only', async () => {
    setup();

    render(<RecordingRulesPage />);

    expect(await within(await findFolderRow('Infra')).findByText('Platform')).toBeInTheDocument();
    expect(within(await findFolderRow('Team Metrics')).queryByText('Platform')).not.toBeInTheDocument();
  });

  it('lists only the filtered folder and stays in Folders mode', async () => {
    setup();

    render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?search=folder%3Ateam'] } });

    expect(await screen.findByRole('link', { name: 'Team Metrics' })).toBeInTheDocument();
    expect(folderToggles()).toEqual(['Expand Team Metrics']);
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
  });

  it("shows a folder's own rules inside its row when expanded, and hides them when collapsed", async () => {
    setup();
    const { user } = render(<RecordingRulesPage />);
    const row = await findFolderRow('Team Metrics');

    await user.click(within(row).getByRole('button', { name: 'Expand Team Metrics' }));

    const ruleLink = await within(row).findByRole('link', { name: 'cpu:usage:rate5m' });
    expect(within(row).getByRole('link', { name: 'disk:usage:rate5m' })).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'mem:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'latency:p99' })).not.toBeInTheDocument();
    // The folder row already names the folder, so the rule row has no path of its own.
    expect(ruleLink.closest('li')).not.toHaveTextContent('Team Metrics');

    await user.click(screen.getByRole('button', { name: 'Collapse Team Metrics' }));

    expect(screen.queryByRole('link', { name: 'cpu:usage:rate5m' })).not.toBeInTheDocument();
  });

  it('keeps a separate Load more for each expanded folder', async () => {
    setup({ pageSize: { rules: 2 } });
    const { user } = render(<RecordingRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Metrics' }));
    await user.click(screen.getByRole('button', { name: 'Expand Infra' }));
    expect(await screen.findByRole('link', { name: 'latency:p99' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'disk:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'mem:usage:rate5m' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more rules in Infra' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more rules in Team Metrics' }));

    expect(await screen.findByRole('link', { name: 'mem:usage:rate5m' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'latency:p99' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();
  });

  it('loads the next page of folders when the end of the list comes into view, keeping the loaded ones, until the last page', async () => {
    setup({ pageSize: { folders: 2 } });
    render(<RecordingRulesPage />);

    expect(await screen.findByRole('link', { name: 'Team Metrics' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Zeta Alerts' })).not.toBeInTheDocument();

    intersection.intersectObserved();

    expect(await screen.findByRole('link', { name: 'Zeta Alerts' })).toBeInTheDocument();
    expect(folderToggles()).toEqual(['Expand Infra', 'Expand Team Metrics', 'Expand Zeta Alerts']);
    expect(screen.queryByTestId('load-more-helper')).not.toBeInTheDocument();
  });

  it('keeps the loaded folders when the next page fails, does not retry on its own, and loads it after Retry', async () => {
    const backend = setup({ pageSize: { folders: 2 } });
    backend.failNext('folderSearch', { continued: true, status: 410 });
    const { user } = render(<RecordingRulesPage />);
    await screen.findByRole('link', { name: 'Team Metrics' });

    intersection.intersectObserved();

    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Infra' })).toBeInTheDocument();
    expect(screen.queryByTestId('load-more-helper')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    // The helper is back once the refetch of every loaded page is done.
    expect(await screen.findByTestId('load-more-helper')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load more results')).not.toBeInTheDocument();
    intersection.intersectObserved();
    expect(await screen.findByRole('link', { name: 'Zeta Alerts' })).toBeInTheDocument();
  });

  it('switches to List for free text, keeps the folder filter, and disables Folders until it is cleared', async () => {
    setup();
    const { user } = render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?search=folder%3Ateam'] } });
    await screen.findByRole('link', { name: 'Team Metrics' });

    await user.type(screen.getByRole('textbox', { name: 'Search' }), ' cpu{Enter}');

    expect(await screen.findByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'disk:usage:rate5m' })).not.toBeInTheDocument();
    // A non-folder filter forces List on its own; `view` keeps only a mode the user chose.
    expect(viewParam()).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('folder:team cpu');
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Folders' })).toHaveAccessibleDescription(
      'Clear filters to browse by folder'
    );

    await user.hover(screen.getByText('Folders'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Clear filters to browse by folder');
  });

  it('switches between Folders and List with the toggle, writing the view to the URL', async () => {
    setup();
    const { user } = render(<RecordingRulesPage />);
    await screen.findByRole('link', { name: 'Team Metrics' });

    await user.click(screen.getByRole('radio', { name: 'List' }));

    expect(await screen.findByRole('link', { name: 'latency:p99' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(viewParam()).toBe('list');

    await user.click(screen.getByRole('radio', { name: 'Folders' }));

    expect(await screen.findByRole('link', { name: 'Team Metrics' })).toBeInTheDocument();
    expect(viewParam()).toBeNull();
  });

  it('shows a message for an expanded folder that has no Recording rules', async () => {
    setup();
    const { user } = render(<RecordingRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Zeta Alerts' }));

    expect(await screen.findByText('No recording rules in this folder')).toBeInTheDocument();
  });

  it('shows an expanded folder rule search failure with Retry, and the rules after Retry', async () => {
    setup().failNext('ruleSearch');
    const { user } = render(<RecordingRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Metrics' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load rules');

    await user.click(screen.getByRole('button', { name: 'Retry loading rules in Team Metrics' }));

    expect(await screen.findByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByText('Failed to load rules')).not.toBeInTheDocument();
  });

  it('restarts the folder list, collapsed, when the folder filter changes', async () => {
    setup({ pageSize: { folders: 1 } });
    const { user } = render(<RecordingRulesPage />, {
      historyOptions: { initialEntries: [`/?${new URLSearchParams({ search: 'folder:infra folder:team' })}`] },
    });
    await user.click(await screen.findByRole('button', { name: 'Expand Infra' }));
    await screen.findByRole('link', { name: 'latency:p99' });
    intersection.intersectObserved();
    expect(await screen.findByRole('link', { name: 'Team Metrics' })).toBeInTheDocument();

    await user.tripleClick(screen.getByRole('textbox', { name: 'Search' }));
    await user.keyboard('folder:infra{Enter}');

    // The same folder reappears under the new filter, but no longer expanded.
    expect(await screen.findByRole('button', { name: 'Expand Infra' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Team Metrics' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'latency:p99' })).not.toBeInTheDocument();
  });

  it('Back and Forward restore Folders and List as the view changes', async () => {
    setup();
    const { user } = render(<RecordingRulesPage />);
    await screen.findByRole('link', { name: 'Team Metrics' });
    await user.click(screen.getByRole('radio', { name: 'List' }));
    await screen.findByRole('link', { name: 'cpu:usage:rate5m' });

    act(() => runtime.locationService.getHistory().goBack());

    expect(await screen.findByRole('button', { name: 'Expand Team Metrics' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(viewParam()).toBeNull();

    act(() => runtime.locationService.getHistory().goForward());

    expect(await screen.findByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
    expect(viewParam()).toBe('list');
  });
});
