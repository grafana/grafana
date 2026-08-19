import { skipToken } from '@reduxjs/toolkit/query';
import userEvent from '@testing-library/user-event';
import { act, render, screen, waitFor, within } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type Notebook, useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { ROWS_PER_PAGE } from '../list/NotebooksTable';
import {
  type NotebookSearchQuery,
  type ResultItem,
  type WhereNode,
  useSearchNotebooksInfiniteQuery,
} from '../list/notebookSearchApi';
import { __resetSearchAvailabilityForTests, NOTEBOOKS_PAGE_LIMIT } from '../list/useNotebooksList';

import { NotebooksListPage } from './NotebooksListPage';

// The route is registered unconditionally, so the page itself enforces this OpenFeature flag.
const NOTEBOOKS_FLAG = 'dashboard.notebooks';

const mockCreateNotebook = jest.fn();

jest.mock('app/api/clients/iam/v0alpha1', () => ({
  useGetDisplayMappingQuery: jest.fn(),
}));

jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  useListNotebookQuery: jest.fn(() => ({ data: undefined, isLoading: false, error: undefined })),
  useCreateNotebookMutation: () => [mockCreateNotebook],
  // The row menu fetches a spec on demand for export; nothing here exercises the fetch itself.
  useLazyGetNotebookQuery: () => [jest.fn()],
}));

jest.mock('../list/notebookSearchApi', () => ({
  useSearchNotebooksInfiniteQuery: jest.fn(),
}));

const mockUseSearchNotebooksQuery = jest.mocked(useSearchNotebooksInfiniteQuery);
const mockUseListNotebookQuery = jest.mocked(useListNotebookQuery);
const mockUseGetDisplayMappingQuery = jest.mocked(useGetDisplayMappingQuery);

function makeHit(name: string, title: string, tags: string[] = [], createdBy = 'user:abc'): ResultItem {
  return {
    resource: { group: 'dashboard.grafana.app', resource: 'notebooks', kind: 'Notebook', name },
    fields: { title, tags, createdBy, created: Date.UTC(2026, 0, 1), updated: Date.UTC(2026, 1, 1) },
  };
}

/** Flattens a where tree into its leaves; v1 is a single leaf or one `and` of leaves. */
function leavesOf(where: WhereNode | undefined): WhereNode[] {
  if (!where) {
    return [];
  }
  return where.and ?? [where];
}

/** A notebook as LIST returns it, for the cases that exercise the fallback path. */
function makeNotebook(name: string, title: string): Notebook {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fixture standing in for a full k8s resource
  return {
    metadata: { name, creationTimestamp: '2026-01-01T00:00:00Z', annotations: { 'grafana.app/createdBy': 'user:abc' } },
    spec: { title, tags: [] },
  } as unknown as Notebook;
}

function setListNotebooks(items: Notebook[], extra: { continueToken?: string } = {}) {
  const data = { items, metadata: { continue: extra.continueToken } };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the page reads
  mockUseListNotebookQuery.mockReturnValue({
    data,
    currentData: data,
    isLoading: false,
    error: undefined,
  } as unknown as ReturnType<typeof useListNotebookQuery>);
}

/** A page the server filled to the limit, which is what truncation looks like on the wire. */
function makeFullPage(): ResultItem[] {
  return Array.from({ length: NOTEBOOKS_PAGE_LIMIT }, (_, i) => makeHit(`nb${i}`, `Notebook ${i}`));
}

/**
 * Stands in for the endpoint, applying the predicates the page sent. Filtering is server-side
 * now, so a fake that ignored the request body would let a wrong query pass unnoticed.
 */
function setNotebooks(
  items: ResultItem[],
  extra: {
    isLoading?: boolean;
    error?: unknown;
    continueToken?: string;
    totalHits?: number;
    totalHitsRelation?: 'eq' | 'lte';
    /** A token with no next page on offer is what the accumulation ceiling looks like. */
    hasNextPage?: boolean;
    /**
     * A request for new filters is in flight and nothing is held for them yet: RTK Query still
     * reports the previous answer as `data`, but not as `currentData`.
     */
    isReloading?: boolean;
    /**
     * Fails only the requests that carry a predicate, leaving the unfiltered one to succeed. That
     * is the case where the reader has a filter to clear.
     */
    errorWhenFiltered?: unknown;
  } = {}
) {
  mockUseSearchNotebooksQuery.mockImplementation((arg) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the hook only ever passes a body or skipToken
    const query = arg === skipToken ? undefined : (arg as NotebookSearchQuery);
    const failure = extra.error ?? (query?.where ? extra.errorWhenFiltered : undefined);

    if (!query || failure) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the page reads
      return {
        data: undefined,
        currentData: undefined,
        isLoading: extra.isLoading ?? false,
        isFetching: false,
        isError: Boolean(failure),
        hasNextPage: false,
        fetchNextPage: jest.fn(),
        error: failure,
      } as unknown as ReturnType<typeof useSearchNotebooksInfiniteQuery>;
    }

    const leaves = leavesOf(query.where);
    const needle = leaves.find((leaf) => leaf.text)?.text?.value.toLowerCase();
    const authors = leaves.find((leaf) => leaf.filter?.field === 'createdBy')?.filter?.values;

    const matched = items.filter((item) => {
      const title = String(item.fields?.title ?? '').toLowerCase();
      const createdBy = String(item.fields?.createdBy ?? '');
      return (!needle || title.includes(needle)) && (!authors || authors.includes(createdBy));
    });

    // One page: what the walk looks like once it has finished, which is every case here bar the
    // ones that set hasNextPage.
    const data = {
      pages: [
        {
          items: matched,
          metadata: {
            continue: extra.continueToken,
            totalHits: extra.totalHits ?? matched.length,
            totalHitsRelation: extra.totalHitsRelation ?? 'eq',
          },
        },
      ],
      pageParams: [undefined],
    };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the page reads
    return {
      data,
      currentData: extra.isReloading ? undefined : data,
      isLoading: extra.isLoading ?? false,
      isFetching: extra.isReloading ?? false,
      isFetchingNextPage: false,
      isError: false,
      hasNextPage: extra.hasNextPage ?? false,
      fetchNextPage: jest.fn(),
      error: undefined,
    } as unknown as ReturnType<typeof useSearchNotebooksInfiniteQuery>;
  });
}

describe('NotebooksListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetSearchAvailabilityForTests();
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the page reads
    mockUseGetDisplayMappingQuery.mockReturnValue({
      data: {
        keys: ['user:abc'],
        display: [{ identity: { type: 'user', name: 'abc' }, displayName: 'Marcus Chen' }],
      },
    } as unknown as ReturnType<typeof useGetDisplayMappingQuery>);
    setNotebooks([]);
  });

  afterEach(async () => {
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state
    // updates while the component is still mounted.
    await act(async () => {
      setTestFlags({});
    });
  });

  it('renders the not-found page when the feature flag is off', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: false });

    render(<NotebooksListPage />);

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('renders a row per notebook, linking the title to the notebook', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([makeHit('nb1', 'Checkout error spike', ['errors'])]);

    render(<NotebooksListPage />);

    const link = await screen.findByRole('link', { name: 'Checkout error spike' });
    expect(link).toHaveAttribute('href', '/notebooks/nb1');
    expect(screen.getByText('Marcus Chen')).toBeInTheDocument();
    expect(screen.getByText('errors')).toBeInTheDocument();
    expect(screen.getByText('1 notebook')).toBeInTheDocument();
  });

  it('points the Edit action at the notebook in edit mode', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([makeHit('nb1', 'Checkout error spike')]);

    render(<NotebooksListPage />);

    expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/notebooks/nb1?edit=true');
  });

  it('hides the Edit action from a user who cannot edit dashboards', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => action !== AccessControlAction.DashboardsWrite);
    setNotebooks([makeHit('nb1', 'Checkout error spike')]);

    render(<NotebooksListPage />);

    // The row still renders, just without a way into edit mode.
    expect(await screen.findByText('Checkout error spike')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('opens a row menu offering export, replacing the old disabled placeholder', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([makeHit('nb1', 'Checkout error spike')]);

    render(<NotebooksListPage />);

    const moreActions = await screen.findByRole('button', { name: 'More actions' });
    expect(moreActions).toBeEnabled();

    await userEvent.click(moreActions);

    expect(await screen.findByRole('menuitem', { name: 'Export' })).toBeInTheDocument();
  });

  it('filters the list by title through the endpoint', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([makeHit('nb1', 'Checkout error spike'), makeHit('nb2', 'Q2 latency regression')]);

    render(<NotebooksListPage />);

    await userEvent.type(await screen.findByPlaceholderText('Search notebooks by title...'), 'latency');

    await waitFor(() => {
      expect(screen.queryByText('Checkout error spike')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Q2 latency regression')).toBeInTheDocument();
    // The narrowing came from the request, not from re-filtering what was already on screen.
    expect(mockUseSearchNotebooksQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { text: { value: 'latency' } } })
    );
  });

  it('filters to the current user with the created-by-me checkbox', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const originalUser = contextSrv.user;
    contextSrv.user = { ...originalUser, uid: 'me' };
    setNotebooks([makeHit('nb1', 'Mine', [], 'user:me'), makeHit('nb2', 'Theirs', [], 'user:other')]);

    try {
      render(<NotebooksListPage />);

      await userEvent.click(await screen.findByLabelText('Created by me'));

      await waitFor(() => {
        expect(screen.queryByText('Theirs')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Mine')).toBeInTheDocument();
    } finally {
      contextSrv.user = originalUser;
    }
  });

  it('shows the not-found empty state when filters match nothing', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([makeHit('nb1', 'Checkout error spike')]);

    render(<NotebooksListPage />);

    await userEvent.type(await screen.findByPlaceholderText('Search notebooks by title...'), 'zzz');

    // Not the create call-to-action: notebooks exist, they just did not match.
    expect(await screen.findByText('No notebooks found')).toBeInTheDocument();
    expect(screen.queryByText("You haven't created any notebooks yet")).not.toBeInTheDocument();
  });

  it('shows the call-to-action empty state when no notebooks exist', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });

    render(<NotebooksListPage />);

    expect(await screen.findByText("You haven't created any notebooks yet")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New notebook' })).toBeInTheDocument();
  });

  it('shows only the error alert when the list fails to load', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([], { error: { status: 500 } });

    render(<NotebooksListPage />);

    expect(await screen.findByText('Failed to load notebooks')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search notebooks by title...')).not.toBeInTheDocument();
    expect(screen.queryByText('No notebooks found')).not.toBeInTheDocument();
  });

  // A failure must not take the filters with it. The query that provoked it is the one thing worth
  // changing, and unmounting the input leaves a page reload as the only way to clear it.
  it('keeps the filters usable when a filtered request fails', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([makeHit('nb1', 'Checkout error spike')], { errorWhenFiltered: { status: 500 } });

    render(<NotebooksListPage />);

    const input = await screen.findByPlaceholderText('Search notebooks by title...');
    await userEvent.type(input, 'zzz');

    expect(await screen.findByText('Failed to load notebooks')).toBeInTheDocument();
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('zzz');
    // Not a no-results state: nothing answered, so nothing can be said about matches.
    expect(screen.queryByText('No notebooks found')).not.toBeInTheDocument();

    await userEvent.clear(input);

    // Recovered without reloading the page, which is the point of keeping the input mounted.
    expect(await screen.findByText('Checkout error spike')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load notebooks')).not.toBeInTheDocument();
  });

  it('surfaces the error detail, so a permissions problem reads differently from an outage', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([], { error: { status: 403, data: { message: 'notebooks feature is not enabled' } } });

    render(<NotebooksListPage />);

    expect(await screen.findByText('notebooks feature is not enabled')).toBeInTheDocument();
  });

  it('tells a viewer none are available rather than that they created none', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    render(<NotebooksListPage />);

    expect(await screen.findByText('No notebooks available to you')).toBeInTheDocument();
    expect(screen.queryByText("You haven't created any notebooks yet")).not.toBeInTheDocument();
  });

  it('reports the server-side total when the page holds only part of it', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks(makeFullPage(), { continueToken: 'next-page', totalHits: 870 });

    render(<NotebooksListPage />);

    expect(await screen.findByText(`Showing ${NOTEBOOKS_PAGE_LIMIT} of 870`)).toBeInTheDocument();
  });

  // The table renders every row it is handed, and each one carries a link, a tag list, two
  // tooltipped timestamps and three buttons — so a full result set has to be paged, or every filter
  // change rebuilds thousands of elements before the click feels answered.
  it('renders one page of rows at a time, and still counts the whole set', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks(makeFullPage());

    render(<NotebooksListPage />);

    expect(await screen.findByText(`${NOTEBOOKS_PAGE_LIMIT} notebooks`)).toBeInTheDocument();
    // One header row plus a page of notebooks.
    expect(screen.getAllByRole('row')).toHaveLength(ROWS_PER_PAGE + 1);
  });

  // Filtering replaces the table's data. A page index kept across that change lands past the end of
  // the narrowed set, and the result is an empty table that no empty state covers — the count in the
  // corner would say one thing and the rows another.
  it('returns to the first page when a filter narrows the set', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    // Three pages, with the only match for "needle" outside the last one.
    setNotebooks(
      Array.from({ length: ROWS_PER_PAGE * 3 }, (_, i) => makeHit(`nb${i}`, i === 0 ? 'needle' : `Filler ${i}`))
    );

    render(<NotebooksListPage />);

    expect(await screen.findByText(`${ROWS_PER_PAGE * 3} notebooks`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '3' }));

    await userEvent.type(screen.getByPlaceholderText('Search notebooks by title...'), 'needle');

    expect(await screen.findByText('1 notebook')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'needle' })).toBeInTheDocument();
  });

  // Rows get a new array identity every time another cursor page lands or an author name resolves.
  // Resetting on that would drag a reader back to page 1 while the list is still filling in.
  it('stays on the page the reader chose while the rows keep arriving', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    const rows = Array.from({ length: ROWS_PER_PAGE * 2 }, (_, i) => makeHit(`nb${i}`, `Notebook ${i}`));
    setNotebooks(rows);
    const titlesOnScreen = () =>
      within(screen.getByRole('table'))
        .getAllByRole('link')
        .map((link) => link.textContent);

    const { rerender } = render(<NotebooksListPage />);

    expect(await screen.findByText(`${ROWS_PER_PAGE * 2} notebooks`)).toBeInTheDocument();
    const firstPage = titlesOnScreen();
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    const secondPage = titlesOnScreen();
    expect(secondPage).not.toEqual(firstPage);

    // A fresh identity for the same filters, as another cursor page arriving produces.
    setNotebooks(rows.map((row) => ({ ...row })));
    rerender(<NotebooksListPage />);

    await waitFor(() => expect(titlesOnScreen()).toEqual(secondPage));
  });

  // A later page can fail after earlier ones already landed. Replacing the whole body with the alert
  // would throw away notebooks the reader can still use.
  it('keeps the rows it loaded when a later page fails, and says some are missing', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    // Rows in hand and an error at the same time: what a mid-walk failure looks like.
    setNotebooks([makeHit('nb1', 'Checkout error spike')]);
    const withRows = mockUseSearchNotebooksQuery.getMockImplementation()!;
    mockUseSearchNotebooksQuery.mockImplementation((arg) => ({
      ...withRows(arg),
      isError: true,
      error: { status: 500, data: { message: 'page three exploded' } },
    }));

    render(<NotebooksListPage />);

    expect(await screen.findByText('Some notebooks could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Checkout error spike' })).toBeInTheDocument();
    // The filters stay usable, and the fatal alert does not appear.
    expect(screen.getByPlaceholderText('Search notebooks by title...')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load notebooks')).not.toBeInTheDocument();
  });

  // Rows are empty while a new set of filters loads, so "No notebooks found" would be a lie — and
  // swapping the filters out for a page-wide spinner would take the caret with them, mid-typing.
  it('shows a loading affordance, not a no-results state, while new filters load', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([makeHit('nb1', 'Checkout error spike')]);

    const { rerender } = render(<NotebooksListPage />);
    await screen.findByRole('link', { name: 'Checkout error spike' });

    // A new set of filters in flight: the previous answer is still held, but not for these filters.
    setNotebooks([makeHit('nb1', 'Checkout error spike')], { isReloading: true });
    rerender(<NotebooksListPage />);

    expect(await screen.findByRole('status', { name: 'Loading notebooks' })).toBeInTheDocument();
    expect(screen.queryByText('No notebooks found')).not.toBeInTheDocument();
    // The filters stay put, caret and all.
    expect(screen.getByPlaceholderText('Search notebooks by title...')).toBeInTheDocument();
  });

  // The counts come from the same absent data as the rows, so leaving them rendered would claim
  // "0 notebooks" next to a loading table on every filter change.
  it('does not claim a count while new filters load', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([makeHit('nb1', 'Checkout error spike')]);

    const { rerender } = render(<NotebooksListPage />);
    expect(await screen.findByText('1 notebook')).toBeInTheDocument();

    setNotebooks([makeHit('nb1', 'Checkout error spike')], { isReloading: true });
    rerender(<NotebooksListPage />);

    await screen.findByRole('status', { name: 'Loading notebooks' });
    expect(screen.queryByText('0 notebooks')).not.toBeInTheDocument();
    expect(screen.queryByText('1 notebook')).not.toBeInTheDocument();
  });

  it('does not serve the previous filter’s rows while the new ones load', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([makeHit('nb1', 'Checkout error spike')]);

    const { rerender } = render(<NotebooksListPage />);
    await screen.findByRole('link', { name: 'Checkout error spike' });

    setNotebooks([makeHit('nb1', 'Checkout error spike')], { isReloading: true });
    rerender(<NotebooksListPage />);

    await screen.findByRole('status', { name: 'Loading notebooks' });
    expect(screen.queryByRole('link', { name: 'Checkout error spike' })).not.toBeInTheDocument();
  });

  // On the fallback path the loaded window and the matches within it are different facts, and LIST
  // reports no total at all — so folding them into "showing 1 of 2" would claim the library holds
  // two matching notebooks when all that is known is that two were fetched.
  it('keeps the loaded count and the match count apart when serving from LIST', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([], { error: { status: 404, data: { message: 'not found' }, config: { url: '' } } });
    setListNotebooks([makeNotebook('nb1', 'Checkout error spike'), makeNotebook('nb2', 'Q2 latency regression')], {
      continueToken: 'next-page',
    });

    render(<NotebooksListPage />);

    await userEvent.type(await screen.findByPlaceholderText('Search notebooks by title...'), 'latency');

    // The debounce has to elapse before the client-side filter narrows anything.
    expect(await screen.findByText('1 notebook')).toBeInTheDocument();
    expect(screen.getByText('First 2 notebooks loaded')).toBeInTheDocument();
  });

  // An inexact total is an upper bound, counted before per-item authorization — so the label has to
  // read as a ceiling. "of 870+" would promise more than exists.
  it('phrases an inexact total as a ceiling', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks(makeFullPage(), { continueToken: 'next-page', totalHits: 870, totalHitsRelation: 'lte' });

    render(<NotebooksListPage />);

    expect(await screen.findByText(`Showing ${NOTEBOOKS_PAGE_LIMIT} of up to 870`)).toBeInTheDocument();
  });

  it('counts only the matches once a filter narrows a truncated list', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([makeHit('nb1', 'Checkout error spike'), makeHit('nb2', 'Q2 latency regression')]);

    render(<NotebooksListPage />);

    await userEvent.type(await screen.findByPlaceholderText('Search notebooks by title...'), 'latency');

    // The server counts the filtered set, so there is one number rather than two.
    await waitFor(() => {
      expect(screen.getByText('1 notebook')).toBeInTheDocument();
    });
  });

  it('hides the create button without dashboards:create', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    setNotebooks([makeHit('nb1', 'Checkout error spike')]);

    render(<NotebooksListPage />);

    expect(await screen.findByText('Checkout error spike')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New notebook' })).not.toBeInTheDocument();
  });

  it('creates a notebook and navigates to it', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setNotebooks([makeHit('nb1', 'Checkout error spike')]);
    mockCreateNotebook.mockReturnValue({
      unwrap: () => Promise.resolve({ metadata: { name: 'nb-new' } }),
    });

    render(<NotebooksListPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'New notebook' }));

    await waitFor(() => {
      expect(locationService.getLocation().pathname).toBe('/notebooks/nb-new');
    });
  });
});
