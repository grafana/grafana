import { fireEvent, render, screen, waitFor } from 'test/test-utils';

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
    created: Date.UTC(2026, 0, 1),
    updated: Date.UTC(2026, 0, 1),
  };
}

function setPicker(overrides: Partial<ReturnType<typeof useNotebookPicker>> = {}) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the modal reads only these fields
  mockUseNotebookPicker.mockReturnValue({
    rows: [row('nb1', 'Q2 latency regression'), row('nb2', 'Checkout error spike')],
    isFiltered: false,
    isTruncated: false,
    isLoading: false,
    error: undefined,
    tagOptions: [],
    searchQuery: '',
    setSearchQuery: jest.fn(),
    createdByMe: false,
    setCreatedByMe: jest.fn(),
    canFilterByMe: true,
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

      expect(screen.getByText(/Not every notebook is shown/)).toBeInTheDocument();
    });

    // Told apart by whether anything is filtering rather than by a total: the server reports no
    // total on the LIST fallback path, so a count cannot answer this everywhere.
    it('tells an empty library apart from an empty result', () => {
      setPicker({ rows: [], isFiltered: false });
      const { unmount } = renderModal();
      expect(screen.getByText(/You have no notebooks yet/)).toBeInTheDocument();
      unmount();

      setPicker({ rows: [], isFiltered: true });
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

    // `required` is satisfied by any non-empty string, and the name is trimmed on the way out, so
    // without validating the trimmed value a notebook could be created titled nothing at all.
    it('will not submit a name that is only whitespace', async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole('tab', { name: 'Create new' }));
      await user.type(screen.getByRole('textbox', { name: /Notebook name/ }), '   ');
      await user.click(screen.getByRole('button', { name: 'Add to notebook' }));

      expect(await screen.findByText('A notebook name is required')).toBeInTheDocument();
      expect(createWithPanel).not.toHaveBeenCalled();
    });

    // Submitted through the form rather than the button because that is the reachable path: the
    // button goes disabled on the next render, but Enter in the name field submits the form directly,
    // and two of those can both get through before React re-renders.
    it('writes once even if the form is submitted twice before it re-renders', async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole('tab', { name: 'Create new' }));
      await user.type(screen.getByRole('textbox', { name: /Notebook name/ }), 'New investigation');

      const form = document.getElementById('add-panel-create-notebook')!;
      fireEvent.submit(form);
      fireEvent.submit(form);

      await waitFor(() => expect(createWithPanel).toHaveBeenCalledTimes(1));
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

  describe('the notebook cards', () => {
    // The design separates the meta line with dots; Card.Meta's own default is a vertical bar.
    it('separates the meta line with dots rather than bars', () => {
      renderModal();

      // Card.Meta renders each separator as its own element, so this is the separator itself rather
      // than a dot that happens to be inside some other text. Two cards, one separator each.
      expect(screen.getAllByText('·')).toHaveLength(2);
      expect(screen.queryByText('|')).not.toBeInTheDocument();
    });

    /**
     * The design puts the tags on their own line under the meta. Card.Tags is a right-hand column of
     * the card's grid, so they have to come from the row below Meta instead - which is the shape this
     * asserts, rather than the CSS: the tag list must not be inside the element holding the meta line.
     */
    it('puts the tags on their own line rather than beside the meta', () => {
      setPicker({ rows: [{ ...row('nb1', 'Q2 latency regression'), tags: ['errors', 'checkout'] }] });
      renderModal();

      const wrapper = screen.getByText('errors').closest('div');

      // Asserted on the grid area because that is what decides this: Card lays its slots out on a
      // grid, where `Tags` is a column beside the meta and `Description` is the row beneath it.
      // Document order is identical either way, so nothing else here can tell the two apart.
      expect(wrapper && getComputedStyle(wrapper).gridArea).toBe('Description');

      // That row spans the card, and TagList right-aligns its chips by default, so without this they
      // would sit at the far edge instead of under the meta line they belong to.
      const list = screen.getByRole('list', { name: 'Tags' });
      expect(getComputedStyle(list).justifyContent).toBe('flex-start');
    });
  });

  describe('filters', () => {
    // MultiCombobox drops aria-label and reads aria-labelledby, so the obvious spelling leaves the
    // control with no accessible name at all.
    it('gives the tag filter an accessible name', () => {
      renderModal();

      expect(screen.getByRole('combobox', { name: 'Filter by tag' })).toBeInTheDocument();
    });

    // No author dropdown: filtering by an author is supported server-side but listing them is not,
    // so the modal offers the one author it can name without an enumeration.
    it('offers a created-by-me toggle in place of an author picker', async () => {
      const setCreatedByMe = jest.fn();
      setPicker({ canFilterByMe: true, setCreatedByMe });
      const { user } = renderModal();

      expect(screen.queryByRole('combobox', { name: 'Filter by author' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('checkbox', { name: 'Created by me' }));

      expect(setCreatedByMe).toHaveBeenCalledWith(true);
    });

    // Nothing to mean without an identity, so the control is not offered at all.
    it('hides the toggle when there is no current user to filter by', () => {
      setPicker({ canFilterByMe: false });
      renderModal();

      expect(screen.queryByRole('checkbox', { name: 'Created by me' })).not.toBeInTheDocument();
    });
  });

  describe('an empty library', () => {
    it('suggests creating one when the reader could', () => {
      setPicker({ rows: [], isFiltered: false });
      renderModal();

      expect(screen.getByText(/Create one instead/)).toBeInTheDocument();
    });

    // dashboards:write opens this picker, dashboards:create is what the create tab needs, so a reader
    // can arrive here with no way to make the notebook they are being told to make.
    it('does not suggest it to a reader who cannot create', () => {
      grant([AccessControlAction.DashboardsWrite]);
      setPicker({ rows: [], isFiltered: false });
      renderModal();

      expect(screen.getByText(/no permission to create one/)).toBeInTheDocument();
      expect(screen.queryByText(/Create one instead/)).not.toBeInTheDocument();
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
