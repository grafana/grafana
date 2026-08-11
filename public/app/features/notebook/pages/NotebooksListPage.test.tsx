import userEvent from '@testing-library/user-event';
import { act, render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type Notebook, useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { defaultSpec as defaultNotebookSpec } from 'app/features/notebook/types';

import { NotebooksListPage } from './NotebooksListPage';

// The route is registered unconditionally, so the page itself enforces this OpenFeature flag.
const NOTEBOOKS_FLAG = 'dashboard.notebooks';

const mockCreateNotebook = jest.fn();

jest.mock('app/api/clients/iam/v0alpha1', () => ({
  useGetDisplayMappingQuery: jest.fn(),
}));

jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  useListNotebookQuery: jest.fn(),
  useCreateNotebookMutation: () => [mockCreateNotebook],
}));

const mockUseListNotebookQuery = jest.mocked(useListNotebookQuery);
const mockUseGetDisplayMappingQuery = jest.mocked(useGetDisplayMappingQuery);

function makeNotebook(name: string, title: string, tags: string[] = []): Notebook {
  return {
    metadata: {
      name,
      creationTimestamp: '2026-01-01T00:00:00Z',
      annotations: { 'grafana.app/createdBy': 'user:abc' },
    },
    spec: {
      ...defaultNotebookSpec(),
      // The schema and generated-client element unions are nominally distinct; these fixtures
      // have no elements, so state that rather than casting the spec across the seam.
      elements: {},
      title,
      tags,
    },
  };
}

function setList(items: Notebook[], extra: { isLoading?: boolean; error?: unknown; continueToken?: string } = {}) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the page reads
  mockUseListNotebookQuery.mockReturnValue({
    data: { items, metadata: { continue: extra.continueToken } },
    isLoading: extra.isLoading ?? false,
    error: extra.error,
  } as unknown as ReturnType<typeof useListNotebookQuery>);
}

describe('NotebooksListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the page reads
    mockUseGetDisplayMappingQuery.mockReturnValue({
      data: {
        keys: ['user:abc'],
        display: [{ identity: { type: 'user', name: 'abc' }, displayName: 'Marcus Chen' }],
      },
    } as unknown as ReturnType<typeof useGetDisplayMappingQuery>);
    setList([]);
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
    setList([makeNotebook('nb1', 'Checkout error spike', ['errors'])]);

    render(<NotebooksListPage />);

    const link = await screen.findByRole('link', { name: 'Checkout error spike' });
    expect(link).toHaveAttribute('href', '/notebooks/nb1');
    expect(screen.getByText('Marcus Chen')).toBeInTheDocument();
    expect(screen.getByText('errors')).toBeInTheDocument();
    expect(screen.getByText('1 notebook')).toBeInTheDocument();
  });

  it('points the Edit action at the same place as the title', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setList([makeNotebook('nb1', 'Checkout error spike')]);

    render(<NotebooksListPage />);

    expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/notebooks/nb1');
  });

  it('filters the list by title', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setList([makeNotebook('nb1', 'Checkout error spike'), makeNotebook('nb2', 'Q2 latency regression')]);

    render(<NotebooksListPage />);

    await userEvent.type(await screen.findByPlaceholderText('Search notebooks by title...'), 'latency');

    await waitFor(() => {
      expect(screen.queryByText('Checkout error spike')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Q2 latency regression')).toBeInTheDocument();
  });

  it('shows the not-found empty state when filters match nothing', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setList([makeNotebook('nb1', 'Checkout error spike')]);

    render(<NotebooksListPage />);

    await userEvent.type(await screen.findByPlaceholderText('Search notebooks by title...'), 'zzz');

    expect(await screen.findByText('No notebooks found')).toBeInTheDocument();
  });

  it('shows the call-to-action empty state when no notebooks exist', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });

    render(<NotebooksListPage />);

    expect(await screen.findByText("You haven't created any notebooks yet")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New notebook' })).toBeInTheDocument();
  });

  it('shows only the error alert when the list fails to load', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setList([], { error: { status: 500 } });

    render(<NotebooksListPage />);

    expect(await screen.findByText('Failed to load notebooks')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search notebooks by title...')).not.toBeInTheDocument();
    expect(screen.queryByText('No notebooks found')).not.toBeInTheDocument();
  });

  it('surfaces the error detail, so a permissions problem reads differently from an outage', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setList([], { error: { status: 403, data: { message: 'notebooks feature is not enabled' } } });

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

  it('reports how many were loaded when the server had more to give', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setList([makeNotebook('nb1', 'Checkout error spike')], { continueToken: 'next-page' });

    render(<NotebooksListPage />);

    expect(await screen.findByText('First 1 notebook loaded')).toBeInTheDocument();
    expect(screen.getByText('1 notebook')).toBeInTheDocument();
  });

  it('keeps the loaded count and the match count separate while filtering a truncated list', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setList([makeNotebook('nb1', 'Checkout error spike'), makeNotebook('nb2', 'Q2 latency regression')], {
      continueToken: 'next-page',
    });

    render(<NotebooksListPage />);

    await userEvent.type(await screen.findByPlaceholderText('Search notebooks by title...'), 'latency');

    // The match count moves with the filter; the loaded count keeps describing the page we hold.
    await waitFor(() => {
      expect(screen.getByText('1 notebook')).toBeInTheDocument();
    });
    expect(screen.getByText('First 2 notebooks loaded')).toBeInTheDocument();
  });

  it('hides the create button without dashboards:create', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    setList([makeNotebook('nb1', 'Checkout error spike')]);

    render(<NotebooksListPage />);

    expect(await screen.findByText('Checkout error spike')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New notebook' })).not.toBeInTheDocument();
  });

  it('creates a notebook and navigates to it', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    setList([makeNotebook('nb1', 'Checkout error spike')]);
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
