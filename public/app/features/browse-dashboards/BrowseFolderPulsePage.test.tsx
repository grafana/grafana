import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom-v5-compat';

import { FolderPulseContent } from './BrowseFolderPulsePage';

// We mock the rollup query directly rather than wiring up a full
// store — every interesting branch of FolderPulseContent is gated
// on the shape of this single hook, so a focused mock keeps the
// test on the UX (filters, columns, empty/error states) and away
// from the network lifecycle.
const useListFolderRollupThreadsQueryMock = jest.fn();

jest.mock('app/features/pulse/api/pulseApi', () => ({
  useListFolderRollupThreadsQuery: (...args: unknown[]) => useListFolderRollupThreadsQueryMock(...args),
}));

function renderContent(folderUID = 'folder-uid', initialEntry = '/dashboards/f/folder-uid/pulse') {
  return render(
    // Both v7 future flags are opted-in here only to silence the
    // upgrade warnings; jest-fail-on-console treats them as hard
    // failures and we don't depend on the v7 behavior either way.
    <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/dashboards/f/:uid/pulse" element={<FolderPulseContent folderUID={folderUID} />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useListFolderRollupThreadsQueryMock.mockReset();
});

describe('FolderPulseContent (rollup)', () => {
  it('shows the unfiltered empty state when no dashboards in the hierarchy have threads', () => {
    useListFolderRollupThreadsQueryMock.mockReturnValue({
      data: { items: [], totalCount: 0, hasMore: false },
      isLoading: false,
      isFetching: false,
    });

    renderContent();

    expect(screen.getByText('No Pulse threads on dashboards in this folder yet')).toBeInTheDocument();
    // The folder rollup is read-only — there must not be a "Start
    // the first thread" CTA here, since folders don't own threads.
    expect(screen.queryByRole('button', { name: 'Start the first thread' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New thread' })).not.toBeInTheDocument();
    expect(screen.queryByText('No matching threads')).not.toBeInTheDocument();
  });

  it('shows the filtered empty state copy when a URL filter is active', () => {
    useListFolderRollupThreadsQueryMock.mockReturnValue({
      data: { items: [], totalCount: 0, hasMore: false },
      isLoading: false,
      isFetching: false,
    });

    renderContent('folder-uid', '/dashboards/f/folder-uid/pulse?status=closed');

    expect(screen.getByText('No matching threads')).toBeInTheDocument();
  });

  it('renders one row per dashboard-bound thread with type, resource, folder, author, and reply count', () => {
    const now = new Date().toISOString();
    useListFolderRollupThreadsQueryMock.mockReturnValue({
      data: {
        items: [
          {
            uid: 'tttttttttttttt0',
            resourceKind: 'dashboard',
            resourceUID: 'dash-1',
            resourceTitle: 'Latency overview',
            folderUID: 'subfolder-1',
            folderTitle: 'Subteam alpha',
            title: 'Discussion about SLOs',
            authorName: 'Alice',
            authorAvatarUrl: '',
            pulseCount: 4,
            lastPulseAt: now,
            closed: false,
          },
          {
            uid: 'tttttttttttttt1',
            resourceKind: 'dashboard',
            resourceUID: 'dash-2',
            resourceTitle: 'Capacity dashboard',
            // Threads on root-level dashboards have no folderUID; the
            // FolderCell must render an em-dash rather than a broken
            // link in that case.
            folderUID: '',
            folderTitle: '',
            title: 'Capacity planning',
            authorName: 'Bob',
            authorAvatarUrl: '',
            pulseCount: 1,
            lastPulseAt: now,
            closed: false,
          },
        ],
        totalCount: 2,
        hasMore: false,
      },
      isLoading: false,
      isFetching: false,
    });

    renderContent();

    // Thread title links navigate back to the dashboard with the
    // pulse drawer pre-opened — assert the href shape so a future
    // refactor can't silently break the deep-link contract.
    const threadLink = screen.getByRole('link', { name: 'Discussion about SLOs' });
    expect(threadLink).toHaveAttribute('href', '/d/dash-1?pulse=thread-tttttttttttttt0');

    // Type column always renders "Dashboard" today; we keep the
    // assertion explicit so a future "Alert" row is a deliberate
    // change rather than a silent regression.
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(2);

    // Resource column links to the dashboard — there's one link per
    // row plus the thread-title link, so we look up by the
    // dashboard's title via the link role.
    expect(screen.getByRole('link', { name: 'Latency overview' })).toHaveAttribute(
      'href',
      '/d/dash-1?pulse=thread-tttttttttttttt0'
    );
    expect(screen.getByRole('link', { name: 'Capacity dashboard' })).toHaveAttribute(
      'href',
      '/d/dash-2?pulse=thread-tttttttttttttt1'
    );

    // Folder column renders a link for rows with a folderUID and an
    // em-dash for rows without — both branches must be exercised
    // because root-level dashboards are common.
    expect(screen.getByRole('link', { name: 'Subteam alpha' })).toHaveAttribute('href', '/dashboards/f/subfolder-1');
    expect(screen.getByText('—')).toBeInTheDocument();

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // Replies = pulseCount - 1 (the root pulse doesn't count as a reply).
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('passes mine + status URL params through to the rollup query', async () => {
    useListFolderRollupThreadsQueryMock.mockReturnValue({
      data: { items: [], totalCount: 0, hasMore: false },
      isLoading: false,
      isFetching: false,
    });

    renderContent('folder-uid', '/dashboards/f/folder-uid/pulse?scope=mine&status=open');

    await waitFor(() => {
      const args = useListFolderRollupThreadsQueryMock.mock.calls.at(-1)?.[0];
      expect(args).toMatchObject({
        folderUID: 'folder-uid',
        mine: true,
        status: 'open',
      });
    });
  });

  it('falls back to the empty state on load failure (no scary red banner)', () => {
    // RTK Query exposes a populated `error` field on failed requests.
    // The rollup view treats failure as a no-data state visually —
    // illustrated EmptyState — and surfaces the failure in the body
    // copy rather than a separate Alert banner above the table.
    useListFolderRollupThreadsQueryMock.mockReturnValue({
      data: undefined,
      error: { status: 500, data: 'boom' },
      isLoading: false,
      isFetching: false,
    });

    renderContent();

    expect(screen.getByText("Couldn't load Pulse threads")).toBeInTheDocument();
    expect(
      screen.getByText('Something went wrong while fetching threads. Please refresh and try again.')
    ).toBeInTheDocument();
    // No raw Alert role above the empty state.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
