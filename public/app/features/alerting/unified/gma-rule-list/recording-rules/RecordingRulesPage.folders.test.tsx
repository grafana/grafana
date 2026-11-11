import { render, screen, within } from 'test/test-utils';

import * as runtime from '@grafana/runtime';

import { setupMswServer } from '../../mockApi';
import { installControllableIntersectionObserver } from '../../mocks/intersectionObserver';

import RecordingRulesPage from './RecordingRulesPage';
import { findFolderRow, setup } from './recordingRulesPageFixture';

setupMswServer();

function folderToggles() {
  return screen
    .getAllByRole('button', { name: /^(Expand|Collapse) / })
    .map((button) => button.getAttribute('aria-label'));
}

describe('RecordingRulesPage folder list', () => {
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
    const backend = setup();

    render(<RecordingRulesPage />);

    expect(await screen.findByRole('link', { name: 'Team Metrics' })).toHaveAttribute(
      'href',
      '/dashboards/f/team/team-metrics/alerting'
    );
    expect(folderToggles()).toEqual(['Expand Infra', 'Expand Team Metrics', 'Expand Zeta Alerts']);
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(backend.folderSearches).toEqual([
      expect.objectContaining({
        labelSelector: { matchLabels: { 'alerting.grafana.app/has-recording-rules': 'true' } },
      }),
    ]);
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
});
