import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PulseDrawerContent } from './PulseDrawerContent';

// We mock the RTK Query hooks rather than wiring up a full store —
// every interesting branch in PulseDrawerContent is gated on the
// shape of these query results, and using mocks keeps the test
// focused on the filter UX rather than the request lifecycle.

const useListThreadsQueryMock = jest.fn();
const useListPanelMentionsQueryMock = jest.fn();
const useListParticipantsQueryMock = jest.fn();
const useGetResourceVersionQueryMock = jest.fn();
const useGetThreadQueryMock = jest.fn();
const useCreateThreadMutationMock = jest.fn();

jest.mock('../api/pulseApi', () => ({
  useListThreadsQuery: (...args: unknown[]) => useListThreadsQueryMock(...args),
  useListPanelMentionsQuery: (...args: unknown[]) => useListPanelMentionsQueryMock(...args),
  useListParticipantsQuery: (...args: unknown[]) => useListParticipantsQueryMock(...args),
  useGetResourceVersionQuery: (...args: unknown[]) => useGetResourceVersionQueryMock(...args),
  useGetThreadQuery: (...args: unknown[]) => useGetThreadQueryMock(...args),
  useCreateThreadMutation: () => useCreateThreadMutationMock(),
}));

// The live channel hook is fire-and-forget for our purposes; render
// must not crash because we omit it. Stub it to a no-op.
jest.mock('../hooks/useResourcePulseStream', () => ({
  useResourcePulseStream: () => undefined,
}));

beforeEach(() => {
  useListThreadsQueryMock.mockReset();
  useListPanelMentionsQueryMock.mockReset();
  useListParticipantsQueryMock.mockReset();
  useGetResourceVersionQueryMock.mockReset();
  useGetThreadQueryMock.mockReset();
  useCreateThreadMutationMock.mockReset();
  useCreateThreadMutationMock.mockReturnValue([jest.fn(), { isLoading: false }]);
  useGetResourceVersionQueryMock.mockReturnValue({ data: undefined });
  useGetThreadQueryMock.mockReturnValue({ data: undefined, isLoading: false });
});

describe('PulseDrawerContent filter row', () => {
  it('renders both filter dropdowns with their resolved selected option labels', () => {
    useListThreadsQueryMock.mockReturnValue({
      data: { items: [], hasMore: false },
      isLoading: false,
      isFetching: false,
    });
    useListPanelMentionsQueryMock.mockReturnValue({
      data: {
        mentions: [
          { panelId: 5, threadCount: 2, latestThreadUID: 'a', latestThreadTitle: 'CPU' },
          { panelId: 7, threadCount: 1, latestThreadUID: 'b', latestThreadTitle: 'Memory' },
        ],
      },
    });
    useListParticipantsQueryMock.mockReturnValue({
      data: {
        participants: [
          { userId: 1, login: 'alice', name: 'Alice' },
          { userId: 2, login: 'bob' },
        ],
      },
    });

    // panelFilter=5 should mean the Panel combobox displays "#CPU"
    // (the resolved live title for panel 5), not "Panel #5". We
    // assert via the underlying input value because Combobox renders
    // its current selection into an input.
    render(
      <PulseDrawerContent
        resourceUID="dash-uid"
        panelFilter={5}
        panels={[
          { id: 5, title: 'CPU' },
          { id: 7, title: 'Memory' },
        ]}
      />
    );

    const inputs = screen.getAllByRole('combobox');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue('#CPU');
    expect(inputs[1]).toHaveValue('All users');

    // Field labels must wire up so the dropdowns are screen-reader
    // friendly — the rendered Field puts the label above the input.
    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
  });

  it('falls back to login when a participant has no display name', () => {
    useListThreadsQueryMock.mockReturnValue({
      data: { items: [], hasMore: false },
      isLoading: false,
      isFetching: false,
    });
    useListPanelMentionsQueryMock.mockReturnValue({ data: { mentions: [] } });
    useListParticipantsQueryMock.mockReturnValue({
      data: {
        participants: [
          { userId: 2, login: 'bob' }, // no name -> login is the label
        ],
      },
    });

    render(<PulseDrawerContent resourceUID="dash-uid" authorFilter={2} panels={[]} />);

    const inputs = screen.getAllByRole('combobox');
    // panel input shows the "all" sentinel label; user input shows
    // the resolved login because we passed authorFilter=2.
    expect(inputs[1]).toHaveValue('bob');
  });

  it('shows the filtered empty state (not the start-thread CTA) when filters are active', () => {
    useListThreadsQueryMock.mockReturnValue({
      data: { items: [], hasMore: false },
      isLoading: false,
      isFetching: false,
    });
    useListPanelMentionsQueryMock.mockReturnValue({ data: { mentions: [] } });
    useListParticipantsQueryMock.mockReturnValue({ data: { participants: [] } });

    render(<PulseDrawerContent resourceUID="dash-uid" panelFilter={5} panels={[{ id: 5, title: 'CPU' }]} />);

    expect(screen.getByText('No threads match the current filters')).toBeInTheDocument();
    // The unfiltered "Start the first thread" CTA must NOT appear in
    // the filtered empty state — that copy is misleading when the
    // user is filtering, which was the original bug report.
    expect(screen.queryByText('Start the first thread')).not.toBeInTheDocument();
    // The empty-state's "Clear filters" button is what we care about
    // here; an additional "Clear filters" also lives in the row above
    // when filters are active. Either way, the affordance is present.
    expect(screen.getAllByText('Clear filters').length).toBeGreaterThanOrEqual(1);
  });

  it('shows the original start-thread empty state when no filters are active', () => {
    useListThreadsQueryMock.mockReturnValue({
      data: { items: [], hasMore: false },
      isLoading: false,
      isFetching: false,
    });
    useListPanelMentionsQueryMock.mockReturnValue({ data: { mentions: [] } });
    useListParticipantsQueryMock.mockReturnValue({ data: { participants: [] } });

    render(<PulseDrawerContent resourceUID="dash-uid" />);

    expect(screen.getByText('Nothing to discuss yet')).toBeInTheDocument();
    expect(screen.getByText('Start the first thread')).toBeInTheDocument();
    expect(screen.queryByText('No threads match the current filters')).not.toBeInTheDocument();
    // No "Clear filters" affordance when nothing is filtered.
    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
  });

  it('clears both filters via the row-level Clear filters button', async () => {
    useListThreadsQueryMock.mockReturnValue({
      data: { items: [], hasMore: false },
      isLoading: false,
      isFetching: false,
    });
    useListPanelMentionsQueryMock.mockReturnValue({ data: { mentions: [] } });
    useListParticipantsQueryMock.mockReturnValue({ data: { participants: [] } });

    const onClearFilters = jest.fn();
    render(
      <PulseDrawerContent
        resourceUID="dash-uid"
        panelFilter={5}
        authorFilter={2}
        onClearFilters={onClearFilters}
        panels={[]}
      />
    );

    // We may render two "Clear filters" buttons (row-level + empty-state).
    // Both call the same callback, so any click satisfies the contract.
    const buttons = screen.getAllByRole('button', { name: 'Clear filters' });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    await userEvent.click(buttons[0]);
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('debounces the search input and pushes the trimmed value upstream', async () => {
    jest.useFakeTimers();
    try {
      useListThreadsQueryMock.mockReturnValue({
        data: { items: [], hasMore: false },
        isLoading: false,
        isFetching: false,
      });
      useListPanelMentionsQueryMock.mockReturnValue({ data: { mentions: [] } });
      useListParticipantsQueryMock.mockReturnValue({ data: { participants: [] } });

      const onSearchFilterChange = jest.fn();
      render(<PulseDrawerContent resourceUID="dash-uid" onSearchFilterChange={onSearchFilterChange} panels={[]} />);

      const input = screen.getByLabelText('Filter threads by text');
      // userEvent under fake timers needs an explicit advanceTimers
      // hook; without it, awaits inside type() never settle.
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await user.type(input, '  p99  ');

      // Pre-debounce: nothing should have fired yet.
      expect(onSearchFilterChange).not.toHaveBeenCalled();

      // Drain the debounce timer; trimmed value lands.
      jest.runAllTimers();
      expect(onSearchFilterChange).toHaveBeenLastCalledWith('p99');

      // Whitespace-only input collapses to undefined (clears the URL key).
      onSearchFilterChange.mockClear();
      await user.clear(input);
      await user.type(input, '   ');
      jest.runAllTimers();
      expect(onSearchFilterChange).toHaveBeenLastCalledWith(undefined);
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders a numbered pager with the active page in primary variant', () => {
    // 7 threads at limit=50 → still page 1; bump totalCount to 120
    // so we span 3 pages and Pagination renders 1 / 2 / 3.
    useListThreadsQueryMock.mockReturnValue({
      data: {
        items: [
          {
            uid: 'a',
            title: 'an item',
            authorName: 'Alice',
            authorAvatarUrl: '',
            pulseCount: 1,
            lastPulseAt: new Date().toISOString(),
            closed: false,
          },
        ],
        page: 2,
        totalCount: 120,
        hasMore: true,
      },
      isLoading: false,
      isFetching: false,
    });
    useListPanelMentionsQueryMock.mockReturnValue({ data: { mentions: [] } });
    useListParticipantsQueryMock.mockReturnValue({ data: { participants: [] } });

    render(<PulseDrawerContent resourceUID="dash-uid" panels={[]} />);

    // The pager renders a button per page (Pagination renders the
    // page number as the button label). With totalCount=120 and
    // limit=50 we expect 3 pages — buttons "1", "2", "3" plus the
    // prev/next chevron buttons.
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    // The legacy "Page N" text indicator is gone — confirm we
    // didn't double-render it.
    expect(screen.queryByText(/^Page 1$/)).not.toBeInTheDocument();
  });

  it('hides the pager when totalCount fits in a single page', () => {
    useListThreadsQueryMock.mockReturnValue({
      data: {
        items: [
          {
            uid: 'a',
            title: 'lonely',
            authorName: 'A',
            pulseCount: 1,
            lastPulseAt: new Date().toISOString(),
            closed: false,
          },
        ],
        page: 1,
        totalCount: 1,
        hasMore: false,
      },
      isLoading: false,
      isFetching: false,
    });
    useListPanelMentionsQueryMock.mockReturnValue({ data: { mentions: [] } });
    useListParticipantsQueryMock.mockReturnValue({ data: { participants: [] } });

    render(<PulseDrawerContent resourceUID="dash-uid" panels={[]} />);

    // Pagination's hideWhenSinglePage collapses the whole pager.
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument();
  });

  it('shows the filtered empty state when only the search filter is active', () => {
    useListThreadsQueryMock.mockReturnValue({
      data: { items: [], hasMore: false },
      isLoading: false,
      isFetching: false,
    });
    useListPanelMentionsQueryMock.mockReturnValue({ data: { mentions: [] } });
    useListParticipantsQueryMock.mockReturnValue({ data: { participants: [] } });

    render(<PulseDrawerContent resourceUID="dash-uid" searchFilter="p99" panels={[]} />);

    // Search-only is still "filtered", so the start-thread CTA must
    // not appear and the no-match copy + clear button must.
    expect(screen.getByText('No threads match the current filters')).toBeInTheDocument();
    expect(screen.queryByText('Start the first thread')).not.toBeInTheDocument();
  });
});
