import { render, screen, waitFor } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NotebookConflictError } from '../api/notebookResource';
import { type NotebookRow } from '../list/useNotebooksList';
import { defaultPanelKind, type PanelKind } from '../types';

import { AddPanelToNotebookModalBody } from './AddPanelToNotebookModalBody';
import { addPanelToExistingNotebook, createNotebookWithPanel } from './addPanelToNotebook';
import { useNotebookPicker } from './useNotebookPicker';

jest.mock('./useNotebookPicker', () => ({
  ...jest.requireActual('./useNotebookPicker'),
  useNotebookPicker: jest.fn(),
}));

jest.mock('./addPanelToNotebook', () => ({
  ...jest.requireActual('./addPanelToNotebook'),
  addPanelToExistingNotebook: jest.fn(),
  createNotebookWithPanel: jest.fn(),
}));

jest.mock('app/core/services/context_srv');

jest.mock('app/core/copy/appNotification', () => ({
  ...jest.requireActual('app/core/copy/appNotification'),
  createSuccessNotification: jest.fn(jest.requireActual('app/core/copy/appNotification').createSuccessNotification),
}));

const mockUseNotebookPicker = jest.mocked(useNotebookPicker);
const addToExisting = jest.mocked(addPanelToExistingNotebook);
const createWithPanel = jest.mocked(createNotebookWithPanel);
const mockContextSrv = jest.mocked(contextSrv);
const mockCreateSuccessNotification = jest.mocked(createSuccessNotification);

function row(uid: string, title: string): NotebookRow {
  return {
    uid,
    title,
    tags: [],
    authorUid: 'user:1',
    authorName: 'Marcus Chen',
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
    blockCount: 1,
  };
}

function setPicker(overrides: Partial<ReturnType<typeof useNotebookPicker>> = {}) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the modal reads only these fields
  mockUseNotebookPicker.mockReturnValue({
    rows: [row('nb1', 'Q2 latency regression'), row('nb2', 'Checkout error spike')],
    totalCount: 2,
    isTruncated: false,
    isLoading: false,
    error: undefined,
    authorOptions: [],
    tagOptions: [],
    searchQuery: '',
    setSearchQuery: jest.fn(),
    authorFilter: '',
    setAuthorFilter: jest.fn(),
    tagFilter: [],
    setTagFilter: jest.fn(),
    sort: 'updated',
    setSort: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useNotebookPicker>);
}

/** Both permissions unless told otherwise — the two tabs are gated on different ones. */
function grant(permissions: string[]) {
  mockContextSrv.hasPermission.mockImplementation((permission) => permissions.includes(permission));
}

function panel(): PanelKind {
  const base = defaultPanelKind();
  return { ...base, spec: { ...base.spec, id: 1, title: 'p95 latency' } };
}

/**
 * Card renders its radio as readOnly and puts the click handler on the heading button, so that
 * button is what actually selects a notebook.
 */
function selectNotebook(title: string) {
  return screen.getByRole('button', { name: title });
}

function renderModal() {
  const buildPanel = jest.fn(async () => panel());
  const onDismiss = jest.fn();
  const result = render(<AddPanelToNotebookModalBody buildPanel={buildPanel} onDismiss={onDismiss} />);
  return { ...result, buildPanel, onDismiss };
}

describe('AddPanelToNotebookModalBody', () => {
  beforeEach(() => {
    mockComboboxRect();
    setPicker();
    grant([AccessControlAction.DashboardsWrite, AccessControlAction.DashboardsCreate]);
    addToExisting.mockResolvedValue({ uid: 'nb1', title: 'Q2 latency regression' });
    createWithPanel.mockResolvedValue({ uid: 'nb3', title: 'New investigation' });
  });

  afterEach(() => jest.clearAllMocks());

  describe('adding to an existing notebook', () => {
    it('cannot be submitted until a notebook is chosen', async () => {
      const { user } = renderModal();

      const submit = screen.getByRole('button', { name: 'Add to notebook' });
      expect(submit).toBeDisabled();

      await user.click(selectNotebook('Q2 latency regression'));

      expect(submit).toBeEnabled();
    });

    it('adds the panel to the chosen notebook and closes', async () => {
      const { user, buildPanel, onDismiss } = renderModal();

      await user.click(selectNotebook('Checkout error spike'));
      await user.click(screen.getByRole('button', { name: 'Add to notebook' }));

      await waitFor(() => expect(addToExisting).toHaveBeenCalledWith('nb2', panel()));
      // Built on submit, so a panel edited while the modal was open is the one that lands.
      expect(buildPanel).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalled();
    });

    it('stays open when the write fails, so the choice is not lost', async () => {
      addToExisting.mockRejectedValue(new NotebookConflictError('the object has been modified'));
      const { user, onDismiss } = renderModal();

      await user.click(selectNotebook('Q2 latency regression'));
      await user.click(screen.getByRole('button', { name: 'Add to notebook' }));

      await waitFor(() => expect(addToExisting).toHaveBeenCalled());
      expect(onDismiss).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Add to notebook' })).toBeEnabled();
    });

    // The uid stays in state so relaxing the filter brings the choice back, but nothing may be
    // submitted to a notebook that is no longer on screen.
    it('cannot be submitted once filtering hides the selected notebook', async () => {
      const { user, rerender } = renderModal();

      await user.click(selectNotebook('Q2 latency regression'));
      expect(screen.getByRole('button', { name: 'Add to notebook' })).toBeEnabled();

      setPicker({ rows: [row('nb2', 'Checkout error spike')] });
      rerender(<AddPanelToNotebookModalBody buildPanel={jest.fn()} onDismiss={jest.fn()} />);

      expect(screen.getByRole('button', { name: 'Add to notebook' })).toBeDisabled();
      expect(addToExisting).not.toHaveBeenCalled();
    });

    it('says the list is partial when the server had more pages', () => {
      setPicker({ isTruncated: true });
      renderModal();

      expect(screen.getByText(/Only your most recent notebooks are shown/)).toBeInTheDocument();
    });

    it('tells an empty library apart from an empty result', () => {
      setPicker({ rows: [], totalCount: 0 });
      const { unmount } = renderModal();
      expect(screen.getByText(/You have no notebooks yet/)).toBeInTheDocument();
      unmount();

      setPicker({ rows: [], totalCount: 4 });
      renderModal();
      expect(screen.getByText(/No notebooks match these filters/)).toBeInTheDocument();
    });
  });

  describe('creating a notebook', () => {
    it('will not submit without a name', async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole('tab', { name: 'Create new' }));
      await user.click(screen.getByRole('button', { name: 'Add to notebook' }));

      expect(await screen.findByText('A notebook name is required')).toBeInTheDocument();
      expect(createWithPanel).not.toHaveBeenCalled();
    });

    // The toast is dispatched to the app notification store rather than rendered in the modal, so
    // this asserts on what the notification was built with.
    it('reports success with a link to the new notebook', async () => {
      const { user, onDismiss } = renderModal();

      await user.click(screen.getByRole('tab', { name: 'Create new' }));
      await user.type(screen.getByRole('textbox', { name: /Notebook name/ }), 'New investigation');
      await user.click(screen.getByRole('button', { name: 'Add to notebook' }));

      await waitFor(() => expect(onDismiss).toHaveBeenCalled());
      const [title, , , component] = mockCreateSuccessNotification.mock.calls[0];
      expect(title).toContain('New investigation');
      expect(component).toBeDefined();
    });

    it('creates the notebook with the panel, description and tags', async () => {
      const { user, onDismiss } = renderModal();

      await user.click(screen.getByRole('tab', { name: 'Create new' }));
      await user.type(screen.getByRole('textbox', { name: /Notebook name/ }), '  Checkout latency  ');
      await user.type(screen.getByRole('textbox', { name: /Description/ }), 'Why is checkout slow?');
      await user.type(screen.getByPlaceholderText('New tag (enter key to add)'), 'latency{enter}');
      await user.click(screen.getByRole('button', { name: 'Add to notebook' }));

      await waitFor(() =>
        expect(createWithPanel).toHaveBeenCalledWith(
          // Trimmed, so a stray space doesn't become part of the notebook's name.
          { title: 'Checkout latency', description: 'Why is checkout slow?', tags: ['latency'] },
          panel()
        )
      );
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe('permissions', () => {
    it('hides the create tab without permission to create', () => {
      grant([AccessControlAction.DashboardsWrite]);
      renderModal();

      expect(screen.getByRole('tab', { name: 'Add to existing' })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Create new' })).not.toBeInTheDocument();
    });

    it('opens on the create tab when the user can only create', () => {
      grant([AccessControlAction.DashboardsCreate]);
      renderModal();

      expect(screen.queryByRole('tab', { name: 'Add to existing' })).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Notebook name/ })).toBeInTheDocument();
    });
  });
});
