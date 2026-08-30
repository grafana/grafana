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

// The create fields now offer the library's existing tags, which reads a facet off this module. It
// calls injectEndpoints on the real client as it loads, which nothing here provides.
jest.mock('../list/notebookSearchApi', () => ({
  useNotebookFieldFacetQuery: jest.fn(() => ({
    data: { items: [], facets: { tags: [{ value: 'latency', count: 1 }] } },
  })),
}));

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
    isReloading: false,
    isLoadingMore: false,
    error: undefined,
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

/** The heading button is the card's only control, and is what actually selects a notebook. */
function selectNotebook(title: string) {
  return screen.getByRole('button', { name: title });
}

/**
 * The modal opens on "New notebook", matching the add-to-dashboard modal, so anything exercising the
 * picker has to ask for the other route first.
 */
async function chooseExisting(user: ReturnType<typeof render>['user']) {
  await user.click(screen.getByRole('radio', { name: 'Existing notebook' }));
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

  // The create route refuses a name that is already taken, and it checks against the picker's rows —
  // which are empty until the first page lands and keep filling after it.
  describe('creating while the notebook list is still loading', () => {
    function submitButton() {
      return screen.getByRole('button', { name: 'Add to notebook' });
    }

    it('cannot be submitted before the first page arrives', async () => {
      setPicker({ rows: [], isLoading: true });
      renderModal();

      expect(submitButton()).toBeDisabled();
    });

    // Rows keep accumulating after `isLoading` goes false, so gating on that alone would still accept
    // a name held by a notebook on a later page.
    it('cannot be submitted while later pages are still arriving', async () => {
      setPicker({ isLoadingMore: true });
      renderModal();

      expect(submitButton()).toBeDisabled();
    });

    it('can be submitted once the rows have stopped arriving', async () => {
      renderModal();

      expect(submitButton()).toBeEnabled();
    });

    // The gate belongs to the create route only — picking an existing notebook does not consult the
    // titles, so a slow walk must not block it.
    it('does not block choosing an existing notebook', async () => {
      setPicker({ isLoadingMore: true });
      const { user } = renderModal();
      await chooseExisting(user);
      await user.click(selectNotebook('Q2 latency regression'));

      expect(submitButton()).toBeEnabled();
    });
  });

  describe('the notebook cards', () => {
    // Card offers a radio alongside the heading button, but it is inert and cannot be grouped with the
    // others - hiding it left every card with a second tab stop and nothing to see at it.
    it('offer one control each, not a heading button and a radio', async () => {
      const { user } = renderModal();
      await chooseExisting(user);

      expect(await screen.findByRole('button', { name: 'Q2 latency regression' })).toBeInTheDocument();
      expect(screen.queryAllByRole('radio', { name: /latency|checkout/i })).toHaveLength(0);
    });

    // The outline says which card is chosen to anyone who can see it; this is what says so to anyone
    // who cannot.
    it('say which one is chosen', async () => {
      const { user } = renderModal();
      await chooseExisting(user);
      await user.click(await screen.findByRole('button', { name: 'Q2 latency regression' }));

      expect(screen.getByRole('button', { name: 'Q2 latency regression (selected)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Checkout error spike' })).toBeInTheDocument();
    });
  });

  describe('adding to an existing notebook', () => {
    it('cannot be submitted until a notebook is chosen', async () => {
      const { user } = renderModal();
      await chooseExisting(user);

      const submit = screen.getByRole('button', { name: 'Add to notebook' });
      expect(submit).toBeDisabled();

      await user.click(selectNotebook('Q2 latency regression'));

      expect(submit).toBeEnabled();
    });

    it('adds the panel to the chosen notebook and closes', async () => {
      const { user, buildPanel, onDismiss } = renderModal();
      await chooseExisting(user);

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
      await chooseExisting(user);

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
      await chooseExisting(user);

      await user.click(selectNotebook('Q2 latency regression'));
      expect(screen.getByRole('button', { name: 'Add to notebook' })).toBeEnabled();

      setPicker({ rows: [row('nb2', 'Checkout error spike')] });
      rerender(<AddPanelToNotebookModalBody buildPanel={jest.fn()} onDismiss={jest.fn()} />);

      expect(screen.getByRole('button', { name: 'Add to notebook' })).toBeDisabled();
      expect(addToExisting).not.toHaveBeenCalled();
    });

    /**
     * The submit branch used to read "existing *with* a selection -> append, everything else ->
     * create", which made creating a notebook the fallback for every unexpected state. Nothing
     * reached it — the button is disabled without a selection, and a disabled default button also
     * suppresses Enter-to-submit — but the shape was one loosened condition away from writing a
     * notebook with no title, so the refusal is now explicit.
     */
    it('writes nothing when submitted on the existing route with no notebook chosen', async () => {
      const { user } = renderModal();
      await chooseExisting(user);

      // Straight at the form, bypassing the disabled button the way a stray Enter would.
      fireEvent.submit(document.getElementById('add-panel-to-notebook')!);

      await waitFor(() => expect(addToExisting).not.toHaveBeenCalled());
      expect(createWithPanel).not.toHaveBeenCalled();
    });

    it('says the list is partial when the server had more pages', async () => {
      setPicker({ isTruncated: true });
      const { user } = renderModal();
      await chooseExisting(user);

      expect(screen.getByText(/Not every notebook is shown/)).toBeInTheDocument();
    });

    /**
     * `isLoading` is the first load only, so once anything has been shown, a change of filters leaves
     * the rows empty while the request is out. Saying "no notebooks match these filters" then claims a
     * result that has not arrived - which is why the hook reports the two states separately.
     */
    it('keeps showing a loading state while new filters are in flight', async () => {
      setPicker({ rows: [], isLoading: false, isReloading: true, isFiltered: true });
      const { user } = renderModal();
      await chooseExisting(user);

      expect(screen.queryByText(/No notebooks match these filters/)).not.toBeInTheDocument();
      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    });

    // Told apart by whether anything is filtering rather than by a total: the server reports no
    // total on the LIST fallback path, so a count cannot answer this everywhere.
    it('tells an empty library apart from an empty result', async () => {
      setPicker({ rows: [], isFiltered: false });
      const first = renderModal();
      await chooseExisting(first.user);
      expect(screen.getByText(/You have no notebooks yet/)).toBeInTheDocument();
      first.unmount();

      setPicker({ rows: [], isFiltered: true });
      const second = renderModal();
      await chooseExisting(second.user);
      expect(screen.getByText(/No notebooks match these filters/)).toBeInTheDocument();
    });
  });

  describe('creating a notebook', () => {
    it('will not submit without a name', async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole('button', { name: 'Add to notebook' }));

      expect(await screen.findByText('A notebook name is required')).toBeInTheDocument();
      expect(createWithPanel).not.toHaveBeenCalled();
    });

    // The toast is dispatched to the app notification store rather than rendered in the modal, so
    // this asserts on what the notification was built with.
    it('reports success with a link to the new notebook', async () => {
      const { user, onDismiss } = renderModal();

      await user.type(screen.getByRole('textbox', { name: /Notebook name/ }), 'New investigation');
      await user.click(screen.getByRole('button', { name: 'Add to notebook' }));

      await waitFor(() => expect(onDismiss).toHaveBeenCalled());
      const [title, , , component] = mockCreateSuccessNotification.mock.calls[0];
      expect(title).toContain('New investigation');
      expect(component).toBeDefined();
    });

    // Saving a dashboard refuses a name already in use; a notebook that silently becomes the second
    // "Checkout latency" is the same confusion, one list further down.
    it('refuses a name another notebook already has', async () => {
      const { user } = renderModal();

      // 'Q2 latency regression' is one of the notebooks the picker is holding.
      await user.type(screen.getByRole('textbox', { name: /Notebook name/ }), 'Q2 latency regression');
      await user.click(screen.getByRole('button', { name: 'Add to notebook' }));

      expect(await screen.findByText('A notebook with this name already exists')).toBeInTheDocument();
      expect(createWithPanel).not.toHaveBeenCalled();
    });

    // Two notebooks differing only in case read as the same one in a list, so the check is not
    // sensitive to it - and neither is the surrounding whitespace, which is trimmed before saving.
    it('refuses a name that differs only by case or surrounding space', async () => {
      const { user } = renderModal();

      await user.type(screen.getByRole('textbox', { name: /Notebook name/ }), '  q2 LATENCY regression  ');
      await user.click(screen.getByRole('button', { name: 'Add to notebook' }));

      expect(await screen.findByText('A notebook with this name already exists')).toBeInTheDocument();
      expect(createWithPanel).not.toHaveBeenCalled();
    });

    // `required` is satisfied by any non-empty string, and the name is trimmed on the way out, so
    // without validating the trimmed value a notebook could be created titled nothing at all.
    it('will not submit a name that is only whitespace', async () => {
      const { user } = renderModal();

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

      await user.type(screen.getByRole('textbox', { name: /Notebook name/ }), 'New investigation');

      const form = document.getElementById('add-panel-to-notebook')!;
      fireEvent.submit(form);
      fireEvent.submit(form);

      await waitFor(() => expect(createWithPanel).toHaveBeenCalledTimes(1));
    });

    it('creates the notebook with the panel, description and tags', async () => {
      const { user, onDismiss } = renderModal();

      await user.type(screen.getByRole('textbox', { name: /Notebook name/ }), '  Checkout latency  ');
      await user.type(screen.getByRole('textbox', { name: /Description/ }), 'Why is checkout slow?');
      await user.type(screen.getByRole('combobox', { name: /Tags/ }), 'latency');
      await user.click(await screen.findByRole('option', { name: /latency/ }));
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
    it('separates the meta line with dots rather than bars', async () => {
      const { user } = renderModal();
      await chooseExisting(user);

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
    it('puts the tags on their own line rather than beside the meta', async () => {
      setPicker({ rows: [{ ...row('nb1', 'Q2 latency regression'), tags: ['errors', 'checkout'] }] });
      const { user } = renderModal();
      await chooseExisting(user);

      const wrapper = screen.getByText('errors').closest('div');

      // Asserted on the grid area because that is what decides this: Card lays its slots out on a
      // grid, where `Tags` is a column beside the meta and `Description` is the row beneath it.
      // Document order is identical either way, so nothing else here can tell the two apart.
      expect(wrapper && getComputedStyle(wrapper).gridArea).toBe('Description');

      // That row spans the card, and TagList right-aligns its chips by default, so without this they
      // would sit at the far edge instead of under the meta line they belong to.
      const list = screen.getByRole('list', { name: 'Tags' });
      expect(getComputedStyle(list).justifyContent).toBe('flex-start');

      // The neutral grey the card also opts into is deliberately not asserted here: it is applied
      // through a `[data-tag-id]` descendant rule, which jsdom does not resolve, so any colour
      // assertion would pass whether or not the class were applied. What that style does is covered
      // by tagColors.test.tsx against the same helper this card uses.
    });
  });

  describe('the picker list', () => {
    /**
     * A card's focus ring sits 2px outside it and extends 4px past that, and the list scrolls, so
     * something between the card and the scrolling element has to hold that room. ScrollContainer's
     * own `padding` prop cannot: it lands on an outer Box, while the inner div is the one with
     * `overflow: auto` — so padding the component insets the whole list and still clips the ring.
     *
     * Asserted as a DOM relationship rather than a measurement, because jsdom does no layout and so
     * cannot be asked whether anything is actually clipped.
     */
    it('holds the room for a card focus ring inside the scrolling element, not outside it', async () => {
      const { user } = renderModal();
      await chooseExisting(user);

      const card = screen.getByRole('button', { name: 'Q2 latency regression' });
      const scroller = card.closest('[tabindex="0"]');
      expect(scroller).not.toBeNull();

      // The scroller's own first child, rather than anything found by walking up from the card: Card
      // has padding of its own, so a walk reports success before it ever leaves the card.
      const inner = scroller!.firstElementChild;
      expect(parseFloat(getComputedStyle(inner!).paddingLeft || '0')).toBeGreaterThan(0);
    });
  });

  describe('filters', () => {
    // No author dropdown: filtering by an author is supported server-side but listing them is not,
    // so the modal offers the one author it can name without an enumeration.
    it('offers a created-by-me toggle in place of an author picker', async () => {
      const setCreatedByMe = jest.fn();
      setPicker({ canFilterByMe: true, setCreatedByMe });
      const { user } = renderModal();
      await chooseExisting(user);

      expect(screen.queryByRole('combobox', { name: 'Filter by author' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('checkbox', { name: 'Created by me' }));

      expect(setCreatedByMe).toHaveBeenCalledWith(true);
    });

    // Checkbox is shorter than the inputs beside it, so centring the row is not enough on its own -
    // it has to be given their height to land on the same centre line. Asserted on the declared
    // height rather than a measurement, since jsdom does no layout.
    it('sits the created-by-me toggle at the height of the controls beside it', async () => {
      const { user } = renderModal();
      await chooseExisting(user);

      // The parent of Checkbox's own root label: it has an inner div of its own, so `closest('div')`
      // would stop inside the component rather than reaching the wrapper this styles.
      const wrapper = screen.getByRole('checkbox', { name: 'Created by me' }).closest('label')?.parentElement;

      // theme.spacing(theme.components.height.md) — the height of the inputs it shares the row with.
      expect(getComputedStyle(wrapper!).minHeight).toBe('32px');
    });

    // Server-side, through the same query the search box uses - the picker does not narrow the rows
    // it was handed.
    it('reports a chosen tag to the filter rather than filtering locally', async () => {
      const setTagFilter = jest.fn();
      setPicker({ setTagFilter });
      const { user } = renderModal();
      await chooseExisting(user);

      await user.click(screen.getByRole('combobox', { name: 'Filter by tag' }));
      await user.click(await screen.findByRole('option', { name: 'latency' }));

      expect(setTagFilter).toHaveBeenCalledWith(['latency']);
    });

    // Nothing to mean without an identity, so the control is not offered at all.
    it('hides the toggle when there is no current user to filter by', async () => {
      setPicker({ canFilterByMe: false });
      const { user } = renderModal();
      await chooseExisting(user);

      expect(screen.queryByRole('checkbox', { name: 'Created by me' })).not.toBeInTheDocument();
    });
  });

  describe('an empty library', () => {
    it('suggests creating one when the reader could', async () => {
      setPicker({ rows: [], isFiltered: false });
      const { user } = renderModal();
      await chooseExisting(user);

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
    // With one route open there is nothing to choose, so the control is not offered at all rather
    // than offered with a single option in it.
    it('drops the chooser and goes straight to the picker for a user who can only add to existing', () => {
      grant([AccessControlAction.DashboardsWrite]);
      renderModal();

      expect(screen.queryByRole('radio', { name: 'New notebook' })).not.toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'Existing notebook' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Q2 latency regression' })).toBeInTheDocument();
    });

    it('drops it the other way for a user who can only create', () => {
      grant([AccessControlAction.DashboardsCreate]);
      renderModal();

      expect(screen.queryByRole('radio', { name: 'Existing notebook' })).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Notebook name/ })).toBeInTheDocument();
    });

    // Both routes open: the chooser appears, and it opens on New the way the add-to-dashboard modal
    // does rather than on the picker.
    it('opens on a new notebook when both routes are available', () => {
      renderModal();

      expect(screen.getByRole('radio', { name: 'New notebook' })).toBeChecked();
      expect(screen.getByRole('textbox', { name: /Notebook name/ })).toBeInTheDocument();
    });
  });
});
