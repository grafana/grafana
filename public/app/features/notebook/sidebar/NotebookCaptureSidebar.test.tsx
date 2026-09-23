import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from 'test/test-utils';

import { type Notebook } from '@grafana/api-clients/rtkq/dashboard/v2beta1';
import { locationService } from '@grafana/runtime';
import { useGetNotebookQuery } from 'app/api/clients/dashboard/v2beta1';

import { useNotebookPicker } from '../addPanel/useNotebookPicker';
import { createNotebook, NotebookConflictError, updateNotebookSpec } from '../api/notebookResource';
import { type NotebookRow } from '../list/useNotebooksList';
import { canCreateNotebooks, canEditNotebooks } from '../permissions';
import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '../types';

import NotebookCaptureSidebar from './NotebookCaptureSidebar';

jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  useGetNotebookQuery: jest.fn(),
}));

jest.mock('../addPanel/useNotebookPicker', () => ({
  useNotebookPicker: jest.fn(),
}));

jest.mock('../api/notebookResource', () => ({
  ...jest.requireActual('../api/notebookResource'),
  createNotebook: jest.fn(),
  updateNotebookSpec: jest.fn(),
}));

jest.mock('../permissions', () => ({
  canCreateNotebooks: jest.fn(),
  canEditNotebooks: jest.fn(),
}));

const mockUseGetNotebookQuery = jest.mocked(useGetNotebookQuery);
const mockUseNotebookPicker = jest.mocked(useNotebookPicker);
const mockCreateNotebook = jest.mocked(createNotebook);
const mockUpdateNotebookSpec = jest.mocked(updateNotebookSpec);
const mockCanCreateNotebooks = jest.mocked(canCreateNotebooks);
const mockCanEditNotebooks = jest.mocked(canEditNotebooks);
const refetch = jest.fn();

const rows: NotebookRow[] = [
  {
    uid: 'nb1',
    title: 'Checkout latency',
    tags: [],
    authorUid: 'user:abc',
    authorName: 'Nathan',
    created: 1,
    updated: 2,
  },
];

function notebookSpec(): NotebookSpec {
  return {
    ...defaultNotebookSpec(),
    title: 'Checkout latency',
    elements: {
      intro: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'Latency started after deploy' } } } },
    },
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: [
          {
            kind: 'NotebookLayoutItem',
            spec: { element: { kind: 'ElementReference', name: 'intro' }, source: 'user' },
          },
        ],
      },
    },
  };
}

function renderSidebar(spec = notebookSpec()) {
  mockUseNotebookPicker.mockReturnValue({
    rows,
    isLoading: false,
    error: undefined,
  } as unknown as ReturnType<typeof useNotebookPicker>);
  mockUseGetNotebookQuery.mockReturnValue({
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal generated resource fixture
    data: { spec } as unknown as Notebook,
    isLoading: false,
    isError: false,
    refetch,
  } as unknown as ReturnType<typeof useGetNotebookQuery>);

  return render(<NotebookCaptureSidebar />);
}

describe('NotebookCaptureSidebar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    mockCanCreateNotebooks.mockReturnValue(true);
    mockCanEditNotebooks.mockReturnValue(true);
    locationService.replace('/dashboards');
    refetch.mockResolvedValue({});
  });

  it('shows the selected notebook and its block outline', () => {
    renderSidebar();

    expect(screen.getByText('Checkout latency')).toBeInTheDocument();
    expect(screen.getByText('Contents')).toBeInTheDocument();
    expect(screen.getByText('Latency started after deploy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit notebook in new tab' })).toHaveAttribute(
      'href',
      '/notebooks/nb1?edit=true'
    );
    expect(screen.getByRole('link', { name: 'Edit notebook in new tab' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'All notebooks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add note' })).toBeDisabled();
  });

  it('opens a read-only notebook in view mode in a new tab', () => {
    mockCanEditNotebooks.mockReturnValue(false);
    renderSidebar();

    const link = screen.getByRole('link', { name: 'Open notebook in new tab' });
    expect(link).toHaveAttribute('href', '/notebooks/nb1');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('creates and selects a notebook without leaving the current page', async () => {
    const user = userEvent.setup();
    mockCreateNotebook.mockResolvedValue({ uid: 'nb2', url: '/notebooks/nb2' });
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'New notebook' }));
    await user.type(screen.getByPlaceholderText('Investigation name'), 'Deploy follow-up');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mockCreateNotebook).toHaveBeenCalledTimes(1));
    expect(mockCreateNotebook).toHaveBeenCalledWith(expect.objectContaining({ title: 'Deploy follow-up' }));
    expect(locationService.getSearchObject().notebookCapture).toBe('nb2');
    expect(screen.getByText('Deploy follow-up')).toBeInTheDocument();
  });

  it('moves directly into capture after creating the first notebook', async () => {
    const user = userEvent.setup();
    mockUseNotebookPicker.mockReturnValue({
      rows: [],
      isLoading: false,
      error: undefined,
    } as unknown as ReturnType<typeof useNotebookPicker>);
    mockUseGetNotebookQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch,
    } as unknown as ReturnType<typeof useGetNotebookQuery>);
    mockCreateNotebook.mockResolvedValue({ uid: 'nb2', url: '/notebooks/nb2' });

    render(<NotebookCaptureSidebar />);

    await user.click(screen.getByRole('button', { name: 'New notebook' }));
    await user.type(screen.getByPlaceholderText('Investigation name'), 'First investigation');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('First investigation')).toBeInTheDocument();
    expect(screen.getByText('Contents')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByPlaceholderText('Add a note…')).toHaveFocus());
  });

  it('creates a default notebook only when the first note is saved', async () => {
    const user = userEvent.setup();
    mockUseNotebookPicker.mockReturnValue({
      rows: [],
      isLoading: false,
      error: undefined,
    } as unknown as ReturnType<typeof useNotebookPicker>);
    mockUseGetNotebookQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch,
    } as unknown as ReturnType<typeof useGetNotebookQuery>);
    mockCreateNotebook.mockResolvedValue({ uid: 'nb2', url: '/notebooks/nb2' });

    render(<NotebookCaptureSidebar />);

    expect(mockCreateNotebook).not.toHaveBeenCalled();
    await user.type(screen.getByPlaceholderText('Add a note…'), 'First finding');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    await waitFor(() => expect(mockCreateNotebook).toHaveBeenCalledTimes(1));
    const createdSpec = mockCreateNotebook.mock.calls[0][0];
    expect(createdSpec.title).toMatch(/^Investigation — /);
    expect(Object.values(createdSpec.elements)).toContainEqual({
      kind: 'Cell',
      spec: { content: { kind: 'Markdown', spec: { text: 'First finding' } } },
    });
    expect(locationService.getSearchObject().notebookCapture).toBe('nb2');
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('explains how to proceed when no notebooks exist and the user cannot create one', () => {
    mockCanCreateNotebooks.mockReturnValue(false);
    mockUseNotebookPicker.mockReturnValue({
      rows: [],
      isLoading: false,
      error: undefined,
    } as unknown as ReturnType<typeof useNotebookPicker>);
    mockUseGetNotebookQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch,
    } as unknown as ReturnType<typeof useGetNotebookQuery>);

    render(<NotebookCaptureSidebar />);

    expect(screen.getByText('No notebooks yet')).toBeInTheDocument();
    expect(screen.getByText(/Ask someone with access/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Add a note…')).not.toBeInTheDocument();
  });

  it('captures a trimmed note and keeps the user in context', async () => {
    const user = userEvent.setup();
    const spec = notebookSpec();
    mockUpdateNotebookSpec.mockImplementation(async (uid, update) => {
      expect(uid).toBe('nb1');
      const updated = update(spec);
      expect(updated.elements.note).toEqual({
        kind: 'Cell',
        spec: { content: { kind: 'Markdown', spec: { text: 'Look at the deploy window' } } },
      });
      return updated;
    });
    renderSidebar(spec);

    const note = screen.getByPlaceholderText('Add a note…');
    await user.type(note, '  Look at the deploy window  ');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    await waitFor(() => expect(mockUpdateNotebookSpec).toHaveBeenCalledTimes(1));
    expect(note).toHaveValue('');
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the draft when the notebook changed', async () => {
    const user = userEvent.setup();
    mockUpdateNotebookSpec.mockRejectedValue(new NotebookConflictError('changed'));
    renderSidebar();

    const note = screen.getByPlaceholderText('Add a note…');
    await user.type(note, 'Keep this draft');
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(await screen.findByText(/This notebook changed while you were updating it/)).toBeInTheDocument();
    expect(note).toHaveValue('Keep this draft');
  });

  it('confirms inline before deleting a block', async () => {
    const user = userEvent.setup();
    const spec = notebookSpec();
    mockUpdateNotebookSpec.mockImplementation(async (_uid, update) => {
      const updated = update(spec);
      expect(updated.layout.spec.cells).toHaveLength(0);
      expect(updated.elements.intro).toBeUndefined();
      return updated;
    });
    renderSidebar(spec);

    await user.click(screen.getByRole('button', { name: 'Delete Latency started after deploy' }));
    expect(screen.getByRole('group', { name: 'Delete Latency started after deploy?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockUpdateNotebookSpec).toHaveBeenCalledTimes(1));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('cancels inline block deletion', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Delete Latency started after deploy' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('group', { name: 'Delete Latency started after deploy?' })).not.toBeInTheDocument();
    expect(mockUpdateNotebookSpec).not.toHaveBeenCalled();
  });
});
