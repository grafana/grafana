import { act, fireEvent, render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';
import { type NotebookLayoutKind } from 'app/features/notebook/types';
import { ShowConfirmModalEvent } from 'app/types/events';

import { type NotebookEditHistory } from '../NotebookEditHistory';
import { NotebookScene } from '../NotebookScene';

// CodeMirror does not run in jsdom; a textarea carries readOnly into the DOM so the edit-mode
// propagation is observable end to end. It stands in for the caret the same way CodeCell.test.tsx
// does — a new `extensions` identity is what rebuilds CodeMirror's view plugins — which makes the
// manager -> frame -> renderer -> cell wiring observable here.
jest.mock('@grafana/ui/unstable', () => {
  // Required inside the factory, which jest hoists above the imports.
  const { useEffect, useRef } = require('react');

  return {
    ...jest.requireActual('@grafana/ui/unstable'),
    CodeMirrorEditor: ({
      value,
      readOnly,
      extensions,
      onChange,
      'aria-label': ariaLabel,
    }: {
      value: string;
      readOnly?: boolean;
      extensions?: unknown[];
      onChange?: (value: string) => void;
      'aria-label'?: string;
    }) => {
      const ref = useRef(null);

      useEffect(() => {
        if (!extensions?.length) {
          return;
        }

        const frame = requestAnimationFrame(() => ref.current?.focus());
        return () => cancelAnimationFrame(frame);
      }, [extensions]);

      return (
        <textarea
          ref={ref}
          aria-label={ariaLabel}
          defaultValue={value}
          readOnly={readOnly}
          onChange={(event) => onChange?.(event.currentTarget.value)}
        />
      );
    },
  };
});

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';

const DRAG_HANDLE_SELECTOR = '[data-rfd-drag-handle-draggable-id]';

function buildManager(cells: NotebookCellItem[], isEditing?: boolean) {
  // The renderer reads the time range via sceneGraph.getTimeRange, which resolves the nearest
  // $timeRange up the graph — attaching it to the manager keeps the test root-agnostic.
  return new NotebookLayoutManager({
    cells,
    title: 'My notebook',
    tags: ['incident', 'checkout'],
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing,
  });
}

function attachHistory(manager: NotebookLayoutManager): NotebookEditHistory {
  const scene = new NotebookScene({
    title: 'My notebook',
    body: manager,
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });

  return scene.editHistory;
}

function renderManager(manager: NotebookLayoutManager) {
  return { manager, ...render(<manager.Component model={manager} />) };
}

function renderNotebook(isEditing?: boolean) {
  const cells = [
    new NotebookCellItem({
      elementName: 'md1',
      source: 'assistant',
      content: { kind: 'Markdown', spec: { text: 'Hello notebook' } },
    }),
    new NotebookCellItem({ elementName: 'hidden-panel', source: 'user', collapsed: true }),
  ];

  return renderManager(buildManager(cells, isEditing));
}

/** Narrative cells only, so a drag test involves no panel plugin loading. */
function buildNarrativeCells(names: string[]) {
  return names.map(
    (name) =>
      new NotebookCellItem({
        elementName: name,
        source: 'user',
        content: { kind: 'Markdown', spec: { text: `Cell ${name}` } },
      })
  );
}

function cellNames(manager: NotebookLayoutManager) {
  return manager.state.cells.map((cell) => cell.state.elementName);
}

describe('NotebookLayoutManager', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the document header with badge, title, time range and tags', async () => {
    renderNotebook();

    expect(screen.getByText('Published Notebook')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My notebook' })).toBeInTheDocument();
    expect(screen.getByText(/now-6h/)).toBeInTheDocument();
    expect(screen.getByText('incident')).toBeInTheDocument();
    expect(screen.getByText('checkout')).toBeInTheDocument();
  });

  it('renders a narrative markdown cell and shows a collapsed cell by name only', async () => {
    renderNotebook();

    // Markdown content is rendered as sanitized HTML after mount.
    expect(await screen.findByText('Hello notebook')).toBeInTheDocument();
    // The collapsed cell renders only its element name, not its content.
    expect(screen.getByText('hidden-panel')).toBeInTheDocument();
  });

  describe('add block dividers', () => {
    it('does not offer insertion points outside edit mode', () => {
      renderNotebook();

      expect(screen.queryByRole('button', { name: 'Add block' })).not.toBeInTheDocument();
    });

    // One insertion point per gap: above the first cell, between the two, and below the last.
    it('renders an insertion point above, between and below the cells in edit mode', () => {
      renderNotebook(true);

      expect(screen.getAllByRole('button', { name: 'Add block' })).toHaveLength(3);
    });

    // Each divider lives inside the frame of the cell above it, which is what makes it *that cell's*
    // insertion point — revealed by hovering the cell, and carried along when the cell is reordered.
    it('places each insertion point inside the frame of the cell above it', async () => {
      renderNotebook(true);

      const frame = (await screen.findByText('Hello notebook')).closest<HTMLElement>('[data-rfd-draggable-id]');

      expect(frame).not.toBeNull();
      expect(within(frame!).getByRole('button', { name: 'Add block' })).toBeInTheDocument();
    });

    // A divider is a gap between things, so an empty notebook has none: with no cell to hover, the
    // leading divider would be an invisible strip found only by accident. The prompt takes over — see
    // the 'add block prompt' describe.
    it('renders no insertion points in an empty notebook', () => {
      renderManager(buildManager([], true));

      expect(screen.queryByRole('button', { name: 'Add block' })).not.toBeInTheDocument();
    });

    it('opens the block type menu', async () => {
      const { user } = renderNotebook(true);

      await user.click(screen.getAllByRole('button', { name: 'Add block' })[0]);

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Heading' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Code' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Visualization' })).toBeInTheDocument();
    });

    // The only assertion that pins childItems: a plain Menu.Item silently drops the submenu chevron.
    it('offers visualizations through a submenu', async () => {
      const { user } = renderNotebook(true);

      await user.click(screen.getAllByRole('button', { name: 'Add block' })[0]);

      expect(screen.getByRole('menuitem', { name: 'Visualization' })).toHaveAttribute('aria-haspopup', 'menu');
    });
  });

  describe('add block prompt', () => {
    // Matched loosely: the exact wording is the designer's, and no test should break on punctuation.
    const PROMPT = /type to start writing/i;

    it('does not offer the prompt outside edit mode', () => {
      renderNotebook();

      expect(screen.queryByRole('button', { name: PROMPT })).not.toBeInTheDocument();
    });

    // Unlike the dividers it is not hover-revealed, so it is queryable with no interaction at all —
    // which is the whole point of it.
    it('renders one prompt at the end of the document in edit mode', () => {
      renderNotebook(true);

      expect(screen.getAllByRole('button', { name: PROMPT })).toHaveLength(1);
    });

    // Pairs with 'renders no insertion points in an empty notebook' above.
    it('is the only affordance in an empty notebook', () => {
      renderManager(buildManager([], true));

      expect(screen.getByRole('button', { name: PROMPT })).toBeInTheDocument();
    });

    // It appends, so unlike a divider it must not be swept along by a cell reorder.
    it('sits outside every cell frame', () => {
      renderNotebook(true);

      expect(screen.getByRole('button', { name: PROMPT }).closest('[data-rfd-draggable-id]')).toBeNull();
    });

    it('opens the same block type menu as the dividers', async () => {
      const { user } = renderNotebook(true);

      await user.click(screen.getByRole('button', { name: PROMPT }));

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Heading' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Code' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Visualization' })).toHaveAttribute('aria-haspopup', 'menu');
    });

    // The printable-key guard is the whole mechanism, and widening it would hijack navigation keys.
    it('leaves navigation keys alone', () => {
      renderNotebook(true);

      const prompt = screen.getByRole('button', { name: PROMPT });
      prompt.focus();
      fireEvent.keyDown(prompt, { key: 'ArrowDown' });

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('cell actions', () => {
    // The bar is inert until its cell is hovered (see NotebookCellFrame), and jsdom does not apply
    // :hover styles, so nothing here can reveal it. These tests are about what the buttons do once
    // reached, not about the reveal, so they opt out of user-event's pointer-events assertion — the
    // gating itself is pinned in NotebookCellFrame.test.tsx.
    const reachActions = () => userEvent.setup({ pointerEventsCheck: 0 });

    it('does not offer them outside edit mode', () => {
      renderNotebook();

      expect(screen.queryByRole('button', { name: 'Duplicate block' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete block' })).not.toBeInTheDocument();
    });

    it('offers duplicate and delete on every cell in edit mode', () => {
      renderNotebook(true);

      expect(screen.getAllByRole('button', { name: 'Duplicate block' })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: 'Delete block' })).toHaveLength(2);
    });

    // Inside the frame, so the existing hover rule reveals them with the rest of the cell's affordances
    // rather than needing a second mechanism.
    it('places them inside the frame of their own cell', async () => {
      renderNotebook(true);

      const frame = (await screen.findByText('Hello notebook')).closest<HTMLElement>('[data-rfd-draggable-id]');

      expect(within(frame!).getByRole('button', { name: 'Duplicate block' })).toBeInTheDocument();
    });

    // ModalsContextProvider (which test-utils' render supplies) tracks the confirmation but ModalRoot,
    // which renders it, is not in the tree — so the event is what these two assert on.
    it('asks before deleting rather than deleting outright', async () => {
      const publish = jest.spyOn(appEvents, 'publish');
      const { manager } = renderManager(buildManager(buildNarrativeCells(['a', 'b', 'c']), true));

      await reachActions().click(screen.getAllByRole('button', { name: 'Delete block' })[1]);

      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish.mock.calls[0][0]).toBeInstanceOf(ShowConfirmModalEvent);
      expect(cellNames(manager)).toEqual(['a', 'b', 'c']);
    });

    it('deletes the cell it belongs to once confirmed', async () => {
      const publish = jest.spyOn(appEvents, 'publish');
      const { manager } = renderManager(buildManager(buildNarrativeCells(['a', 'b', 'c']), true));

      await reachActions().click(screen.getAllByRole('button', { name: 'Delete block' })[1]);
      act(() => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (publish.mock.calls[0][0] as ShowConfirmModalEvent).payload.onConfirm?.();
      });

      expect(cellNames(manager)).toEqual(['a', 'c']);
    });

    it('duplicates the cell directly below itself', async () => {
      const { manager } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));

      await reachActions().click(screen.getAllByRole('button', { name: 'Duplicate block' })[0]);

      expect(cellNames(manager)).toEqual(['a', 'a-copy-1', 'b']);
    });
  });

  describe('duplicateCell', () => {
    it('copies the content rather than sharing it', () => {
      const manager = buildManager(buildNarrativeCells(['a']));

      manager.duplicateCell(manager.state.cells[0]);

      const [original, copy] = manager.state.cells;
      expect(copy.state.content).toEqual({ kind: 'Markdown', spec: { text: 'Cell a' } });
      expect(copy.state.content).not.toBe(original.state.content);

      // In-place edits (or a setState that reuses spec) must not leak across the pair.
      if (original.state.content?.kind === 'Markdown') {
        original.state.content.spec.text = 'changed';
      }
      expect(copy.state.content).toEqual({ kind: 'Markdown', spec: { text: 'Cell a' } });
    });

    // serialize() writes elementName as the key into the notebook's `elements` map, so a shared name
    // would collapse the two cells into one element on the next round-trip — an alias, not a copy.
    it('gives the copy an unused element name', () => {
      const manager = buildManager(buildNarrativeCells(['a']));

      manager.duplicateCell(manager.state.cells[0]);
      manager.duplicateCell(manager.state.cells[0]);

      expect(cellNames(manager)).toEqual(['a', 'a-copy-2', 'a-copy-1']);
    });

    // A reused panel-<id> key collides in findVizPanelByKey and in the panelId that feeds query caching.
    it('rekeys a duplicated panel cell', () => {
      const manager = buildManager([
        new NotebookCellItem({
          elementName: 'latency',
          source: 'user',
          body: new VizPanel({ key: 'panel-1', pluginId: 'timeseries' }),
        }),
      ]);

      manager.duplicateCell(manager.state.cells[0]);

      const keys = manager.getVizPanels().map((panel) => panel.state.key);
      expect(new Set(keys).size).toBe(2);
    });

    it('ignores a cell that is not in the notebook', () => {
      const manager = buildManager(buildNarrativeCells(['a']));

      manager.duplicateCell(buildNarrativeCells(['stranger'])[0]);

      expect(cellNames(manager)).toEqual(['a']);
    });
  });

  describe('addCell', () => {
    const PROMPT = /type to start writing/i;

    async function pickCode(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
      await user.click(trigger);
      await user.click(screen.getByRole('menuitem', { name: 'Code' }));
    }

    // A divider belongs to the cell above it, so the one inside cell 'a' inserts between 'a' and 'b'.
    // The leading divider comes first in the DOM, so index 1 is cell 'a' s own divider.
    it('inserts an empty code cell where the divider offered it', async () => {
      const { manager, user } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));

      await pickCode(user, screen.getAllByRole('button', { name: 'Add block' })[1]);

      expect(cellNames(manager)).toEqual(['a', 'code-1', 'b']);
      expect(manager.state.cells[1].state.content).toEqual({ kind: 'Code', spec: { language: '', code: '' } });
      // Inserted because a person asked for it, not because the assistant proposed it.
      expect(manager.state.cells[1].state.source).toBe('user');
    });

    it('inserts above the first cell from the leading divider', async () => {
      const { manager, user } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));

      await pickCode(user, screen.getAllByRole('button', { name: 'Add block' })[0]);

      expect(cellNames(manager)).toEqual(['code-1', 'a', 'b']);
    });

    it('appends from the end-of-document prompt', async () => {
      const { manager, user } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));

      await pickCode(user, screen.getByRole('button', { name: PROMPT }));

      expect(cellNames(manager)).toEqual(['a', 'b', 'code-1']);
    });

    // The prompt is the only affordance an empty notebook has, so this is the sole path to a first cell.
    it('gives an empty notebook its first cell', async () => {
      const { manager, user } = renderManager(buildManager([], true));

      await pickCode(user, screen.getByRole('button', { name: PROMPT }));

      expect(cellNames(manager)).toEqual(['code-1']);
    });

    // serialize() writes elementName as the key into the notebook's `elements` map, so a repeat would
    // collapse the two cells into one element on the next round-trip.
    it('gives every inserted cell an unused element name', () => {
      const manager = buildManager(buildNarrativeCells(['code-1']));

      manager.addCell('code', 1);
      manager.addCell('code', 2);

      expect(cellNames(manager)).toEqual(['code-1', 'code-2', 'code-3']);
    });

    // The cell arrives editable rather than needing a second interaction to become so — the notebook is
    // already in edit mode, which is the only way to reach the menu at all.
    it('renders the new cell as an editable code editor', async () => {
      const { user } = renderManager(buildManager([], true));

      await pickCode(user, screen.getByRole('button', { name: PROMPT }));

      expect(await screen.findByRole('textbox', { name: 'Code' })).not.toHaveAttribute('readonly');
      expect(screen.getByRole('combobox', { name: 'Code language' })).toBeInTheDocument();
    });

    // The reader asked for a block, so the caret belongs in it rather than one click away. It is also
    // a race the cell has to win: the block menu hands focus back to the button that opened it as it
    // closes.
    it('hands the caret to the new cell', async () => {
      const { user } = renderManager(buildManager([], true));

      await pickCode(user, screen.getByRole('button', { name: PROMPT }));

      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Code' })).toHaveFocus());
    });

    // Only the newest one: every earlier cell keeps its content but gives up the caret, so a second
    // insertion does not leave two editors fighting over it.
    it('moves the caret on to the next cell it inserts', async () => {
      const { user } = renderManager(buildManager([], true));

      await pickCode(user, screen.getByRole('button', { name: PROMPT }));
      await pickCode(user, screen.getByRole('button', { name: PROMPT }));

      await waitFor(() => {
        const editors = screen.getAllByRole('textbox', { name: 'Code' });
        expect(editors).toHaveLength(2);
        expect(editors[0]).not.toHaveFocus();
        expect(editors[1]).toHaveFocus();
      });
    });

    // Cells the reader did not just insert are left alone, however they arrived.
    it('leaves the caret alone in a code cell the reader did not insert', async () => {
      const cells = [
        new NotebookCellItem({
          elementName: 'existing',
          source: 'assistant',
          content: { kind: 'Code', spec: { code: 'select 1', language: 'sql' } },
        }),
      ];
      renderManager(buildManager(cells, true));

      // The cell asks for the caret a frame late, so this has to outlast that window to mean anything.
      await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      expect(screen.getByRole('textbox', { name: 'Code' })).not.toHaveFocus();
    });

    // Only code is buildable so far. The rest of the menu stays inert rather than inserting a cell with
    // no content kind behind it, which the renderer would draw as a blank gap.
    it('leaves the block types it cannot build yet alone', () => {
      const manager = buildManager(buildNarrativeCells(['a']));

      expect(manager.addCell('heading', 1)).toBeUndefined();
      expect(manager.addCell('paragraph', 1)).toBeUndefined();
      expect(manager.addCell('visualization', 1)).toBeUndefined();
      expect(cellNames(manager)).toEqual(['a']);
    });

    // What the renderer hands the caret to, so it has to be the cell that landed in the list.
    it('returns the inserted cell', () => {
      const manager = buildManager(buildNarrativeCells(['a']));

      expect(manager.addCell('code', 0)).toBe(manager.state.cells[0]);
    });
  });

  describe('drag handles', () => {
    it('does not render drag handles outside edit mode', () => {
      const { container } = renderNotebook();

      expect(container.querySelectorAll(DRAG_HANDLE_SELECTOR)).toHaveLength(0);
    });

    // dragHandleProps sets role="button" but supplies no name, so the aria-label is what makes the
    // handle announceable at all.
    it('renders a named drag handle per cell in edit mode', () => {
      renderNotebook(true);

      expect(screen.getAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(2);
    });

    // The handle is a tab stop, which is what gives keyboard users the reorder for free — and the
    // reason the frame reveals affordances on :focus-within as well as :hover.
    it('keeps the handle focusable', () => {
      const { container } = renderNotebook(true);

      const handle = container.querySelector<HTMLElement>(DRAG_HANDLE_SELECTOR)!;
      handle.focus();

      expect(handle).toHaveFocus();
    });
  });

  describe('moveCell', () => {
    function buildForMove() {
      return buildManager(buildNarrativeCells(['a', 'b', 'c']));
    }

    it('moves a cell down', () => {
      const manager = buildForMove();

      manager.moveCell(0, 2);

      expect(cellNames(manager)).toEqual(['b', 'c', 'a']);
    });

    it('moves a cell up', () => {
      const manager = buildForMove();

      manager.moveCell(2, 0);

      expect(cellNames(manager)).toEqual(['c', 'a', 'b']);
    });

    // The cell object itself moves, so a panel cell keeps its VizPanel and its already-fetched data.
    it('moves the cell object rather than a copy', () => {
      const manager = buildForMove();
      const [first] = manager.state.cells;

      manager.moveCell(0, 1);

      expect(manager.state.cells[1]).toBe(first);
    });

    // A mutated-in-place array would not notify subscribers, so the renderer would not update.
    it('replaces the cells array', () => {
      const manager = buildForMove();
      const before = manager.state.cells;

      manager.moveCell(0, 1);

      expect(manager.state.cells).not.toBe(before);
    });
  });

  // The one integration test for the dnd wiring. Real pointer drags are impractical in jsdom (every
  // getBoundingClientRect is zero), so this drives dnd's keyboard sensor and waits on its own aria-live
  // announcements between phases — the same approach as the dashboard sidebar list tests. It covers
  // Droppable/Draggable wiring, draggableId uniqueness and index correctness end to end.
  it('reorders the cells when a cell is dragged down one position', async () => {
    const { manager, container, findByText } = renderManager(buildManager(buildNarrativeCells(['a', 'b', 'c']), true));

    const handle = container.querySelectorAll<HTMLElement>(DRAG_HANDLE_SELECTOR)[0];
    handle.focus();

    fireEvent.keyDown(handle, { keyCode: 32 });
    await findByText(/you have lifted an item/i);

    fireEvent.keyDown(handle, { keyCode: 40 });
    await findByText(/you have moved the item/i);

    fireEvent.keyDown(handle, { keyCode: 32 });
    await findByText(/you have dropped the item/i);

    expect(cellNames(manager)).toEqual(['b', 'a', 'c']);
  });

  describe('editModeChanged', () => {
    // The scene owns the mode; this is the channel it uses to hand the flag down, so the cells can
    // react without the manager reaching back up to the scene.
    it('records the mode so the cells can read it', () => {
      const manager = new NotebookLayoutManager({ cells: [] });

      expect(manager.state.isEditing).toBeUndefined();

      manager.editModeChanged(true);
      expect(manager.state.isEditing).toBe(true);

      manager.editModeChanged(false);
      expect(manager.state.isEditing).toBe(false);
    });

    it('reaches a code cell, which stops being read only', async () => {
      const manager = new NotebookLayoutManager({
        cells: [
          new NotebookCellItem({
            elementName: 'query',
            source: 'user',
            content: { kind: 'Code', spec: { code: 'select 1', language: 'sql' } },
          }),
        ],
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      });

      render(<manager.Component model={manager} />);

      const editor = await screen.findByLabelText('Code');
      expect(editor).toHaveAttribute('readonly');

      // act: the renderer subscribes to the manager, so this re-renders the cell.
      act(() => manager.editModeChanged(true));

      expect(screen.getByLabelText('Code')).not.toHaveAttribute('readonly');
    });
  });

  describe('setCellContent', () => {
    const edited = { kind: 'Code' as const, spec: { code: 'select 2', language: 'sql' } };

    function codeCell(elementName: string) {
      return new NotebookCellItem({
        elementName,
        source: 'user',
        content: { kind: 'Code', spec: { code: 'select 1', language: 'sql' } },
      });
    }

    it('applies the content to the edited cell', () => {
      const cell = codeCell('query');
      const manager = new NotebookLayoutManager({ cells: [cell] });

      manager.setCellContent(cell, edited);

      expect(cell.state.content).toEqual(edited);
    });

    // Two layout items may legally reference one element. serialize() folds them back into a single
    // elements[name] entry where the last cell wins, so an edit that reached only the edited cell
    // would be silently discarded by an unedited duplicate that follows it.
    it('applies the content to every cell referencing the same element', () => {
      const first = codeCell('query');
      const second = codeCell('query');
      const manager = new NotebookLayoutManager({ cells: [first, second] });

      manager.setCellContent(first, edited);

      expect(second.state.content).toEqual(edited);
    });

    it('leaves cells referencing a different element alone', () => {
      const cell = codeCell('query');
      const other = codeCell('other-query');
      const manager = new NotebookLayoutManager({ cells: [cell, other] });

      manager.setCellContent(cell, edited);

      expect(other.state.content).toEqual({ kind: 'Code', spec: { code: 'select 1', language: 'sql' } });
    });

    // The manager binds this onto NotebookCellFrame, which forwards it to the cell renderer. Every
    // other case here calls the method directly, so without this one the whole chain could be
    // unwired and they would all still pass.
    it('is reached by typing into a rendered code cell', async () => {
      const cell = codeCell('query');
      const manager = new NotebookLayoutManager({
        cells: [cell],
        isEditing: true,
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      });

      const { user } = render(<manager.Component model={manager} />);

      const editor = await screen.findByLabelText('Code');
      await user.clear(editor);
      await user.type(editor, 'select 2');

      expect(cell.state.content).toEqual(edited);
    });

    it('does not give a panel cell narrative content', () => {
      const cell = codeCell('query');
      // A panel and a narrative cell should never share a name, but a panel must not sprout content
      // if they do — getElements branches on `panel` first, so it would corrupt the panel's element.
      const panel = new NotebookCellItem({ elementName: 'query', source: 'user' });
      const manager = new NotebookLayoutManager({ cells: [cell, panel] });

      manager.setCellContent(cell, edited);

      expect(panel.state.content).toBeUndefined();
    });

    it('coalesces rapid editor changes into one undo action', async () => {
      const first = codeCell('query');
      const second = codeCell('query');
      const manager = new NotebookLayoutManager({
        cells: [first, second],
        isEditing: true,
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      });
      const history = attachHistory(manager);
      const { user } = render(<manager.Component model={manager} />);

      const editor = (await screen.findAllByLabelText('Code'))[0];
      await user.clear(editor);
      await user.type(editor, 'select 2');

      expect(history.state.canUndo).toBe(true);
      expect(history.state.undoLabel).toBe('Edit block');

      expect(first.state.content).toEqual(edited);
      expect(second.state.content).toEqual(edited);

      act(() => history.undo());
      expect(first.state.content).toEqual({ kind: 'Code', spec: { code: 'select 1', language: 'sql' } });
      expect(second.state.content).toEqual({ kind: 'Code', spec: { code: 'select 1', language: 'sql' } });
      expect(history.state.canRedo).toBe(true);

      act(() => history.redo());
      expect(first.state.content).toEqual(edited);
      expect(second.state.content).toEqual(edited);
    });

    it('drops an editor transaction that returns to its starting content', () => {
      const cell = codeCell('query');
      const manager = new NotebookLayoutManager({ cells: [cell] });
      const history = attachHistory(manager);

      manager.setCellContent(cell, edited);
      manager.setCellContent(cell, { kind: 'Code', spec: { code: 'select 1', language: 'sql' } });

      expect(history.state.canUndo).toBe(false);
    });

    // If the edit is not closed on the way out, typing after coming back is added to the old edit.
    it('closes a pending edit when the notebook is deactivated', () => {
      const cell = codeCell('query');
      const manager = new NotebookLayoutManager({ cells: [cell] });
      const history = attachHistory(manager);
      const deactivate = manager.activate();

      manager.setCellContent(cell, edited);
      deactivate();
      manager.setCellContent(cell, { kind: 'Code', spec: { code: 'select 3', language: 'sql' } });

      expect(history.state.canUndo).toBe(true);
      history.undo();
      expect(cell.state.content).toEqual(edited);
    });

    it('starts a new undo step after the coalescing window', () => {
      jest.useFakeTimers();
      try {
        const cell = codeCell('query');
        const manager = new NotebookLayoutManager({ cells: [cell] });
        const history = attachHistory(manager);

        manager.setCellContent(cell, edited);
        jest.advanceTimersByTime(801);
        manager.setCellContent(cell, { kind: 'Code', spec: { code: 'select 3', language: 'sql' } });

        history.undo();
        expect(cell.state.content).toEqual(edited);
        history.undo();
        expect(cell.state.content).toEqual({ kind: 'Code', spec: { code: 'select 1', language: 'sql' } });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('edit history', () => {
    function withHistory(cells: NotebookCellItem[]) {
      const manager = buildManager(cells);
      return { manager, history: attachHistory(manager) };
    }

    it('undoes and redoes adding a block', () => {
      const { manager, history } = withHistory(buildNarrativeCells(['a']));

      const added = manager.addCell('code', 1);
      expect(cellNames(manager)).toEqual(['a', added?.state.elementName]);

      history.undo();
      expect(cellNames(manager)).toEqual(['a']);

      history.redo();
      expect(manager.state.cells[1]).toBe(added);
    });

    it('undoes and redoes a move', () => {
      const { manager, history } = withHistory(buildNarrativeCells(['a', 'b', 'c']));

      manager.moveCell(0, 2);
      expect(cellNames(manager)).toEqual(['b', 'c', 'a']);

      history.undo();
      expect(cellNames(manager)).toEqual(['a', 'b', 'c']);

      history.redo();
      expect(cellNames(manager)).toEqual(['b', 'c', 'a']);
    });

    it('restores the same cell after delete', () => {
      const cells = buildNarrativeCells(['a', 'b']);
      const { manager, history } = withHistory(cells);

      manager.removeCell(cells[0]);
      expect(cellNames(manager)).toEqual(['b']);

      history.undo();
      expect(manager.state.cells[0]).toBe(cells[0]);

      history.redo();
      expect(cellNames(manager)).toEqual(['b']);
    });

    it('removes the exact duplicate on undo', () => {
      const cells = buildNarrativeCells(['a']);
      const { manager, history } = withHistory(cells);

      manager.duplicateCell(cells[0]);
      const duplicate = manager.state.cells[1];

      history.undo();
      expect(manager.state.cells).toEqual(cells);

      history.redo();
      expect(manager.state.cells[1]).toBe(duplicate);
    });
  });

  it('serializes to the notebook layout kind, not a dashboard layout kind', () => {
    const manager = new NotebookLayoutManager({
      cells: [new NotebookCellItem({ elementName: 'md1', source: 'assistant' })],
    });

    // The annotation carries the real check: serialize() is typed as the notebook's own kind, so
    // widening it back to the dashboard layout union fails `yarn typecheck`. It does not fail this
    // test run, since jest strips the types.
    const result: NotebookLayoutKind = manager.serialize();

    expect(result.kind).toBe('NotebookLayout');
  });

  describe('duplicate', () => {
    function buildManager() {
      return new NotebookLayoutManager({
        cells: [
          new NotebookCellItem({
            elementName: 'md1',
            source: 'assistant',
            content: { kind: 'Markdown', spec: { text: 'Hello' } },
          }),
          new NotebookCellItem({
            elementName: 'latency',
            source: 'user',
            body: new VizPanel({ key: 'panel-1', pluginId: 'timeseries' }),
          }),
          new NotebookCellItem({
            elementName: 'errors',
            source: 'user',
            body: new VizPanel({ key: 'panel-2', pluginId: 'timeseries' }),
          }),
        ],
      });
    }

    it('rekeys the cloned panels from the generator', () => {
      let next = 41;

      const clone = buildManager().duplicate(() => next++);

      expect(clone.getVizPanels().map((panel) => panel.state.key)).toEqual(['panel-41', 'panel-42']);
    });

    // Without a generator the manager seeds one off its own max id, so a duplicate never reuses the
    // originals' keys.
    it('rekeys past the existing ids when no generator is given', () => {
      const manager = buildManager();

      const clone = manager.duplicate();

      expect(clone.getVizPanels().map((panel) => panel.state.key)).toEqual(['panel-3', 'panel-4']);
      expect(manager.getVizPanels().map((panel) => panel.state.key)).toEqual(['panel-1', 'panel-2']);
    });

    it('clones narrative cells unchanged', () => {
      const manager = buildManager();
      const original = manager.state.cells[0];

      const clone = manager.duplicate();

      expect(clone.state.cells).toHaveLength(3);
      expect(clone.state.cells[0].state.body).toBeUndefined();
      expect(clone.state.cells[0].state.content).toEqual({ kind: 'Markdown', spec: { text: 'Hello' } });
      expect(clone.state.cells[0].state.content).not.toBe(original.state.content);
    });
  });
});
