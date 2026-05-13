import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom-v5-compat';

import { contextSrv } from 'app/core/services/context_srv';

import { FolderPulseContent } from './BrowseFolderPulsePage';

// We mock the RTK Query hooks rather than wiring up a full store —
// every interesting branch in FolderPulseContent is gated on the
// shape of these query results, so mocks keep the test focused on
// the UX (filters, deep-link, drawer) rather than the network
// lifecycle. Same shape as PulseDrawerContent.test.tsx for parity.
const useListThreadsQueryMock = jest.fn();
const useListParticipantsQueryMock = jest.fn();
const useGetResourceVersionQueryMock = jest.fn();
const useGetThreadQueryMock = jest.fn();
const useCreateThreadMutationMock = jest.fn();
const useListPulsesQueryMock = jest.fn();
const createThreadMock = jest.fn();

jest.mock('app/features/pulse/api/pulseApi', () => {
  // Defined inside the factory because jest.mock hoists above the
  // top-of-file consts, so a shared `const noopMutation` declared up
  // there would be in the TDZ at mock-evaluation time.
  const noopMutation = () => [jest.fn(), { isLoading: false }];
  return {
    useListThreadsQuery: (...args: unknown[]) => useListThreadsQueryMock(...args),
    useListParticipantsQuery: (...args: unknown[]) => useListParticipantsQueryMock(...args),
    useGetResourceVersionQuery: (...args: unknown[]) => useGetResourceVersionQueryMock(...args),
    useGetThreadQuery: (...args: unknown[]) => useGetThreadQueryMock(...args),
    useCreateThreadMutation: () => useCreateThreadMutationMock(),
    // Thread-view-side hooks. We only assert against the list/composer
    // path in this suite, so all the per-thread mutations resolve to
    // no-op tuples that match the RTK Query mutation hook shape.
    useListPulsesQuery: (...args: unknown[]) => useListPulsesQueryMock(...args),
    useAddPulseMutation: noopMutation,
    useEditPulseMutation: noopMutation,
    useDeletePulseMutation: noopMutation,
    useDeleteThreadMutation: noopMutation,
    useCloseThreadMutation: noopMutation,
    useReopenThreadMutation: noopMutation,
    useMarkReadMutation: noopMutation,
  };
});

// Sibling lookups + the live channel are fire-and-forget for these
// tests; stub to deterministic no-ops so render never crashes.
jest.mock('app/features/pulse/hooks/useResourcePulseStream', () => ({
  useResourcePulseStream: () => undefined,
}));
jest.mock('app/features/pulse/hooks/useFolderDashboards', () => ({
  useFolderDashboards: () => ({ items: [], loading: false, error: null }),
}));

// contextSrv reads happen at render — pin user.id and the role probe
// so empty-state and admin gating behave deterministically. We patch
// in place rather than replace the module wholesale: other modules
// pulled in via FolderDetailsActions call methods we don't care
// about (licensedAccessControlEnabled, hasPermission, etc.) and a
// blanket `jest.mock` would have to enumerate every one.
beforeAll(() => {
  Object.assign(contextSrv, {
    user: { ...(contextSrv.user ?? {}), id: 42 },
    isGrafanaAdmin: false,
  });
  jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
});

function renderContent(folderUID = 'folder-uid', initialEntry = '/dashboards/f/folder-uid/pulse') {
  return render(
    // Both v7 future flags are opted-in here only to silence the
    // upgrade warnings; jest-fail-on-console treats them as hard
    // failures and we don't depend on the v7 behavior either way.
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/dashboards/f/:uid/pulse" element={<FolderPulseContent folderUID={folderUID} />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useListThreadsQueryMock.mockReset();
  useListParticipantsQueryMock.mockReset();
  useGetResourceVersionQueryMock.mockReset();
  useGetThreadQueryMock.mockReset();
  useCreateThreadMutationMock.mockReset();
  createThreadMock.mockReset();

  // unwrap() returns a Promise; the page awaits it on submit.
  createThreadMock.mockReturnValue({ unwrap: () => Promise.resolve({ thread: { uid: 'new-thread' } }) });

  useCreateThreadMutationMock.mockReturnValue([createThreadMock, { isLoading: false }]);
  useGetResourceVersionQueryMock.mockReturnValue({ data: undefined });
  useGetThreadQueryMock.mockReturnValue({ data: undefined, isLoading: false });
  useListParticipantsQueryMock.mockReturnValue({ data: { participants: [] } });
  useListPulsesQueryMock.mockReturnValue({ data: { items: [] }, isLoading: false });
});

describe('FolderPulseContent', () => {
  it('shows the unfiltered empty state with a Start CTA when there are no threads and no filters', () => {
    useListThreadsQueryMock.mockReturnValue({
      data: { items: [], totalCount: 0, hasMore: false },
      isLoading: false,
      isFetching: false,
    });

    renderContent();

    expect(screen.getByText('No threads in this folder yet')).toBeInTheDocument();
    // The empty-state CTA must be present when no filters are active —
    // it's how users discover the "New thread" affordance with an
    // empty folder.
    expect(screen.getByRole('button', { name: 'Start the first thread' })).toBeInTheDocument();
    // The "filtered" copy must not appear in the unfiltered state, or
    // the empty-state message is actively misleading.
    expect(screen.queryByText('No matching threads')).not.toBeInTheDocument();
  });

  it('shows the filtered empty state copy when a URL filter is active', () => {
    useListThreadsQueryMock.mockReturnValue({
      data: { items: [], totalCount: 0, hasMore: false },
      isLoading: false,
      isFetching: false,
    });

    // status=closed counts as an active filter; the empty-state should
    // tell the user the cause is the filter, not the absence of data.
    renderContent('folder-uid', '/dashboards/f/folder-uid/pulse?status=closed');

    expect(screen.getByText('No matching threads')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start the first thread' })).not.toBeInTheDocument();
  });

  it('renders one row per thread with the author name and reply count', () => {
    useListThreadsQueryMock.mockReturnValue({
      data: {
        items: [
          {
            uid: 'tttttttttttttt0',
            resourceKind: 'folder',
            resourceUID: 'folder-uid',
            title: 'Discussion about SLOs',
            authorName: 'Alice',
            authorAvatarUrl: '',
            pulseCount: 4,
            lastPulseAt: new Date().toISOString(),
            closed: false,
          },
          {
            uid: 'tttttttttttttt1',
            resourceKind: 'folder',
            resourceUID: 'folder-uid',
            title: 'Capacity planning',
            authorName: 'Bob',
            authorAvatarUrl: '',
            pulseCount: 1,
            lastPulseAt: new Date().toISOString(),
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

    expect(screen.getByText('Discussion about SLOs')).toBeInTheDocument();
    expect(screen.getByText('Capacity planning')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // Replies = pulseCount - 1 (the root pulse doesn't count as a reply).
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('passes mine + status URL params to the listThreads query', async () => {
    useListThreadsQueryMock.mockReturnValue({
      data: { items: [], totalCount: 0, hasMore: false },
      isLoading: false,
      isFetching: false,
    });

    renderContent('folder-uid', '/dashboards/f/folder-uid/pulse?scope=mine&status=open');

    // The hook is invoked once per render; the latest call carries the
    // current query state. We assert on a recent call rather than first
    // so a fast re-render doesn't cause a false negative.
    await waitFor(() => {
      const args = useListThreadsQueryMock.mock.calls.at(-1)?.[0];
      expect(args).toMatchObject({
        resourceKind: 'folder',
        resourceUID: 'folder-uid',
        mine: true,
        status: 'open',
      });
    });
  });

  it('opens the composer drawer when the New thread button is clicked', async () => {
    useListThreadsQueryMock.mockReturnValue({
      data: { items: [], totalCount: 0, hasMore: false },
      isLoading: false,
      isFetching: false,
    });

    renderContent();

    // Two "New thread" affordances on the empty-state path: the
    // toolbar button and the empty-state Start CTA. Either should
    // open the composer drawer; the toolbar is the canonical one.
    await userEvent.click(screen.getByRole('button', { name: 'New thread' }));

    // Drawer renders a dialog with the title we passed in. Finding by
    // accessible role (rather than text) guards against the title copy
    // changing.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Start a thread in this folder')).toBeInTheDocument();
    // The composer's title input is always present when showTitle is
    // true — proves the composer mounted inside the drawer rather
    // than just rendering an empty shell.
    expect(within(dialog).getByLabelText('Thread title')).toBeInTheDocument();
  });

  it('renders the thread view when a ?pulse=thread-<uid> deep link is present', () => {
    // The deep link resolves through the standalone getThread query
    // because the thread is not in the (empty) listThreads result set.
    useListThreadsQueryMock.mockReturnValue({
      data: { items: [], totalCount: 0, hasMore: false },
      isLoading: false,
      isFetching: false,
    });
    useGetThreadQueryMock.mockReturnValue({
      data: {
        uid: 'deeplink-uid',
        resourceKind: 'folder',
        resourceUID: 'folder-uid',
        title: 'Linked from overview',
        authorName: 'Eve',
        authorAvatarUrl: '',
        pulseCount: 1,
        lastPulseAt: new Date().toISOString(),
        closed: false,
        pulses: [
          {
            uid: 'pulse-1',
            authorName: 'Eve',
            authorAvatarUrl: '',
            bodyText: 'root pulse',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            body: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'root pulse' }] }] } },
          },
        ],
      },
      isLoading: false,
    });

    renderContent('folder-uid', '/dashboards/f/folder-uid/pulse?pulse=thread-deeplink-uid');

    expect(screen.getByText('Linked from overview')).toBeInTheDocument();
    // The empty-state of the list view must not co-exist with the
    // thread view; the page switches surfaces entirely on deep link.
    expect(screen.queryByText('No threads in this folder yet')).not.toBeInTheDocument();
  });
});
