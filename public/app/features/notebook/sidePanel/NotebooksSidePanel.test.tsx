import { render, screen, waitFor } from 'test/test-utils';

import { store } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { useNotebookPicker } from '../addPanel/useNotebookPicker';
import * as notebookResource from '../api/notebookResource';

import { NotebooksSidePanel } from './NotebooksSidePanel';
import { clearOpenSidePanelNotebook, getOpenSidePanelNotebook } from './openSidePanelNotebook';

jest.mock('../addPanel/useNotebookPicker', () => ({
  useNotebookPicker: jest.fn(),
}));

jest.mock('../embed/NotebookView', () => ({
  NotebookView: ({ uid, enterEditMode }: { uid: string; enterEditMode?: boolean }) => (
    <div data-testid="notebook-view">{`${uid}:${String(enterEditMode)}`}</div>
  ),
}));

const mockPicker = jest.mocked(useNotebookPicker);

function setPicker(rows: Array<{ uid: string; title: string }>, overrides: Record<string, unknown> = {}) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the fields the panel reads
  mockPicker.mockReturnValue({
    rows: rows.map((r) => ({
      tags: [],
      authorUid: '',
      authorName: 'Me',
      created: Date.UTC(2026, 0, 1),
      updated: Date.UTC(2026, 0, 1),
      ...r,
    })),
    searchQuery: '',
    setSearchQuery: jest.fn(),
    tagFilter: [],
    setTagFilter: jest.fn(),
    createdByMe: false,
    setCreatedByMe: jest.fn(),
    canFilterByMe: true,
    isFiltered: false,
    isLoading: false,
    isReloading: false,
    isTruncated: false,
    error: undefined,
    ...overrides,
  } as unknown as ReturnType<typeof useNotebookPicker>);
}

describe('NotebooksSidePanel', () => {
  beforeEach(() => {
    store.delete('grafana.notebooks.sidePanel.uid');
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    setPicker([{ uid: 'nb-1', title: 'Latency investigation' }]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearOpenSidePanelNotebook();
  });

  it('opens an existing notebook picked from the list', async () => {
    const { user } = render(<NotebooksSidePanel onClose={jest.fn()} />);

    await user.click(await screen.findByRole('radio', { name: 'Latency investigation' }));

    expect(await screen.findByTestId('notebook-view')).toHaveTextContent('nb-1:false');
  });

  it('creates a notebook and opens it in edit mode', async () => {
    const create = jest.spyOn(notebookResource, 'createNotebook').mockResolvedValue({
      uid: 'new-1',
      url: '/notebooks/new-1',
      generation: 1,
      resourceVersion: '1',
    });
    const { user } = render(<NotebooksSidePanel onClose={jest.fn()} />);

    await user.type(screen.getByLabelText('New notebook title'), 'Fresh');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(screen.getByTestId('notebook-view')).toHaveTextContent('new-1:true'));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fresh' }));
  });

  it('hides creation without the create permission', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockImplementation((action) => action !== 'notebooks:create');
    render(<NotebooksSidePanel onClose={jest.fn()} />);

    expect(screen.queryByLabelText('New notebook title')).not.toBeInTheDocument();
    expect(screen.getByText('Latency investigation')).toBeInTheDocument();
  });

  it('returns to the chooser from an open notebook', async () => {
    const { user } = render(<NotebooksSidePanel onClose={jest.fn()} />);
    await user.click(await screen.findByRole('radio', { name: 'Latency investigation' }));

    await user.click(screen.getByRole('button', { name: 'Back to notebooks' }));

    expect(screen.queryByTestId('notebook-view')).not.toBeInTheDocument();
    expect(screen.getByText('Open an existing notebook')).toBeInTheDocument();
  });

  describe('filters', () => {
    it('toggles the created-by-me filter', async () => {
      const setCreatedByMe = jest.fn();
      setPicker([{ uid: 'nb-1', title: 'Latency investigation' }], { setCreatedByMe });
      const { user } = render(<NotebooksSidePanel onClose={jest.fn()} />);

      await user.click(screen.getByLabelText('Created by me'));

      expect(setCreatedByMe).toHaveBeenCalledWith(true);
    });

    it('offers the tag filter, and hides created-by-me when the user is unknown', () => {
      setPicker([{ uid: 'nb-1', title: 'Latency investigation' }], { canFilterByMe: false });
      render(<NotebooksSidePanel onClose={jest.fn()} />);

      expect(screen.getByText('Filter by tag')).toBeInTheDocument();
      expect(screen.queryByLabelText('Created by me')).not.toBeInTheDocument();
    });
  });

  describe('open notebook signal', () => {
    it('is unset in the chooser and set once a notebook is open', async () => {
      const { user } = render(<NotebooksSidePanel onClose={jest.fn()} />);
      expect(getOpenSidePanelNotebook()).toBeUndefined();

      await user.click(await screen.findByRole('radio', { name: 'Latency investigation' }));

      await waitFor(() => expect(getOpenSidePanelNotebook()).toEqual(expect.objectContaining({ uid: 'nb-1' })));
    });

    it('clears when going back to the chooser', async () => {
      const { user } = render(<NotebooksSidePanel onClose={jest.fn()} />);
      await user.click(await screen.findByRole('radio', { name: 'Latency investigation' }));
      await waitFor(() => expect(getOpenSidePanelNotebook()).toBeDefined());

      await user.click(screen.getByRole('button', { name: 'Back to notebooks' }));

      expect(getOpenSidePanelNotebook()).toBeUndefined();
    });

    it('clears when the panel unmounts, as when the sidebar closes', async () => {
      const { user, unmount } = render(<NotebooksSidePanel onClose={jest.fn()} />);
      await user.click(await screen.findByRole('radio', { name: 'Latency investigation' }));
      await waitFor(() => expect(getOpenSidePanelNotebook()).toBeDefined());

      unmount();

      expect(getOpenSidePanelNotebook()).toBeUndefined();
    });
  });
});
