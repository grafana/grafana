import { skipToken } from '@reduxjs/toolkit/query';
import userEvent from '@testing-library/user-event';
import { act, render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import {
  type NotebookSearchQuery,
  type ResultItem,
  type WhereNode,
  useSearchNotebooksQuery,
} from '../list/notebookSearchApi';
import { __resetSearchAvailabilityForTests } from '../list/useNotebooksList';

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
}));

jest.mock('../list/notebookSearchApi', () => ({
  useSearchNotebooksQuery: jest.fn(),
}));

const mockUseSearchNotebooksQuery = jest.mocked(useSearchNotebooksQuery);
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

/**
 * Stands in for the endpoint, applying the predicates the page sent. Filtering is server-side
 * now, so a fake that ignored the request body would let a wrong query pass unnoticed.
 */
function setNotebooks(
  items: ResultItem[],
  extra: { isLoading?: boolean; error?: unknown; continueToken?: string; totalHits?: number } = {}
) {
  mockUseSearchNotebooksQuery.mockImplementation((arg) => {
    if (arg === skipToken || extra.error) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the page reads
      return {
        data: undefined,
        isLoading: extra.isLoading ?? false,
        error: arg === skipToken ? undefined : extra.error,
      } as unknown as ReturnType<typeof useSearchNotebooksQuery>;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the hook only ever passes a body or skipToken
    const query = arg as NotebookSearchQuery;
    const leaves = leavesOf(query.where);
    const needle = leaves.find((leaf) => leaf.text)?.text?.value.toLowerCase();
    const authors = leaves.find((leaf) => leaf.filter?.field === 'createdBy')?.filter?.values;

    const matched = items.filter((item) => {
      const title = String(item.fields?.title ?? '').toLowerCase();
      const createdBy = String(item.fields?.createdBy ?? '');
      return (!needle || title.includes(needle)) && (!authors || authors.includes(createdBy));
    });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the page reads
    return {
      data: {
        items: matched,
        metadata: {
          continue: extra.continueToken,
          totalHits: extra.totalHits ?? matched.length,
          totalHitsRelation: 'eq',
        },
      },
      isLoading: extra.isLoading ?? false,
      error: undefined,
    } as unknown as ReturnType<typeof useSearchNotebooksQuery>;
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
    setNotebooks([makeHit('nb1', 'Checkout error spike')], { continueToken: 'next-page', totalHits: 87 });

    render(<NotebooksListPage />);

    expect(await screen.findByText('Showing 1 of 87')).toBeInTheDocument();
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
