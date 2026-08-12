import { fireEvent, render, screen, within } from 'test/test-utils';

import { SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type NotebookLayoutKind } from 'app/features/notebook/types';

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

    // What makes the copy honest: "press / for blocks" has to do something.
    it('opens the menu when a printable key is typed', async () => {
      renderNotebook(true);

      const prompt = screen.getByRole('button', { name: PROMPT });
      prompt.focus();
      fireEvent.keyDown(prompt, { key: '/' });

      expect(await screen.findByRole('menu')).toBeInTheDocument();
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
      const clone = buildManager().duplicate();

      expect(clone.state.cells).toHaveLength(3);
      expect(clone.state.cells[0].state.body).toBeUndefined();
      expect(clone.state.cells[0].state.content).toEqual({ kind: 'Markdown', spec: { text: 'Hello' } });
    });
  });
});
