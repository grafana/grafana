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
//
// CodeCell passes only its (optional) focus request as `extensions`, so any non-empty array means one
// was made. A markdown cell's baseline is higher and fixed, not merely "non-empty": every markdown
// cell rendered through this tree gets the live-preview extension, the placeholder (SpecialMarkdownCell
// passes one to every markdown cell unconditionally — see NotebookCellRenderer), and the Enter/
// Shift-Enter keymap (also unconditional now — Shift-Enter's list-continuation binding no longer
// depends on onSubmit), for a baseline of 3. A focus request adds exactly one more on top of that.
//
// Real CodeMirrorEditor never sees a raw re-render-fresh `extensions` array either: CodeEditor.tsx
// wraps it in useShallowStable precisely because callers pass inline literals on every render (its own
// doc comment says so). Without reproducing that here, every markdown cell's own three-item baseline
// would re-fire this stub's fake focus effect on every keystroke, stealing focus back from whatever
// cell the reader is actually typing into — useStableExtensions below is what keeps the identity (and
// so the effect) stable across a re-render that does not actually change what's requested.
jest.mock('@grafana/ui/unstable', () => {
  // Required inside the factory, which jest hoists above the imports.
  const { useEffect, useRef } = require('react');

  function useStableExtensions(extensions: unknown[] | undefined) {
    const ref = useRef(extensions);
    const previous = ref.current;
    const sameLength = Array.isArray(previous) && Array.isArray(extensions) && previous.length === extensions.length;
    const shallowEqual = previous === extensions || (sameLength && previous.every((v, i) => v === extensions[i]));
    if (!shallowEqual) {
      ref.current = extensions;
    }
    return ref.current;
  }

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
      const stableExtensions = useStableExtensions(extensions);
      const focusThreshold = ariaLabel === 'Markdown' ? 4 : 1;

      useEffect(() => {
        if (!stableExtensions || stableExtensions.length < focusThreshold) {
          return;
        }

        const frame = requestAnimationFrame(() => ref.current?.focus());
        return () => cancelAnimationFrame(frame);
      }, [stableExtensions, focusThreshold]);

      return (
        <textarea
          ref={ref}
          aria-label={ariaLabel}
          // Controlled: every markdown cell resets its own buffer via onChange -> setCellContent, and
          // a real CodeMirrorEditor's `value` is genuinely controlled too — an uncontrolled stub would
          // leave stale text in the DOM across that reset, which nothing in a real browser would ever do.
          value={value}
          readOnly={readOnly}
          onChange={(event) => onChange?.(event.currentTarget.value)}
        />
      );
    },
  };
});

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager, splitSeed } from './NotebookLayoutManager';

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

function attachScene(manager: NotebookLayoutManager): NotebookScene {
  return new NotebookScene({
    title: 'My notebook',
    body: manager,
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
}

function attachHistory(manager: NotebookLayoutManager): NotebookEditHistory {
  return attachScene(manager).editHistory;
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

    // One insertion point per gap: above the first cell, between each pair, and below the last —
    // three real cells by the time this renders (the trailing empty cell the invariant appends after
    // renderNotebook's collapsed panel counts as a fourth gap), so four dividers, not three.
    it('renders an insertion point above, between and below the cells in edit mode', () => {
      renderNotebook(true);

      expect(screen.getAllByRole('button', { name: 'Add block' })).toHaveLength(4);
    });

    // Each divider lives inside the frame of the cell above it, which is what makes it *that cell's*
    // insertion point — revealed by hovering the cell, and carried along when the cell is reordered.
    it('places each insertion point inside the frame of the cell above it', async () => {
      renderNotebook(true);

      const frame = (await screen.findByText('Hello notebook')).closest<HTMLElement>('[data-rfd-draggable-id]');

      expect(frame).not.toBeNull();
      expect(within(frame!).getByRole('button', { name: 'Add block' })).toBeInTheDocument();
    });

    // A divider is a gap between things, so it would be invisible with no cell to hover — but a
    // genuinely empty notebook in edit mode does not stay that way: the trailing-invariant bootstrap
    // gives it a first cell immediately (see 'the trailing empty cell' describe), one cell meaning
    // two gaps (leading, and below that one cell), not zero.
    it('renders insertion points once an empty notebook gets its first cell', () => {
      renderManager(buildManager([], true));

      expect(screen.getAllByRole('button', { name: 'Add block' })).toHaveLength(2);
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

  // The "always one more empty block ready" invariant: unlike the old dedicated prompt component,
  // there is no separate affordance any more — the trailing cell in `cells` itself is always an empty,
  // placeholder-showing markdown editor, and offers the same "/" menu any empty markdown cell does
  // (see NotebookCellRenderer/NotebookLayoutManager's own setCellContent doc comment).
  describe('the trailing empty cell', () => {
    function trailingTextbox() {
      const editors = screen.getAllByRole('textbox', { name: 'Markdown' });
      return editors[editors.length - 1];
    }

    it('is not rendered outside edit mode', () => {
      renderManager(buildManager([], false));

      expect(screen.queryByRole('textbox', { name: 'Markdown' })).not.toBeInTheDocument();
    });

    // A brand-new notebook gets its first cell for free, so a reader can start typing immediately.
    it('gives an empty notebook its first cell', () => {
      renderManager(buildManager([], true));

      expect(screen.getAllByRole('textbox', { name: 'Markdown' })).toHaveLength(1);
    });

    // A notebook whose last cell already has content — including a non-markdown or collapsed one —
    // still gets a fresh empty cell appended after it.
    it('appends a fresh empty cell after a notebook that already ends with content', () => {
      const { manager } = renderNotebook(true);

      expect(cellNames(manager)).toEqual(['md1', 'hidden-panel', 'paragraph-1']);
      expect(manager.state.cells[2].state.content).toEqual({ kind: 'Markdown', spec: { text: '' } });
    });

    // A markdown cell is a real cell rendered through the exact same path as any other — it isn't
    // excluded from the notebook's own drag-and-drop wiring the way the old dedicated prompt was.
    it('renders like any other cell, inside its own draggable frame', () => {
      renderManager(buildManager([], true));

      expect(trailingTextbox().closest('[data-rfd-draggable-id]')).not.toBeNull();
    });

    it('opens the block type menu on a lone "/"', async () => {
      const { user } = renderManager(buildManager([], true));

      await user.type(trailingTextbox(), '/');

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Heading' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Code' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Visualization' })).toHaveAttribute('aria-haspopup', 'menu');
    });

    // Regular typing (anything but a lone "/") never opens the menu — it is just markdown text.
    it('leaves plain typing alone', async () => {
      const { user } = renderManager(buildManager([], true));

      await user.type(trailingTextbox(), 'Hello');

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    // The bug fixed earlier this session: the menu opening but never closing again once the "/" it
    // was keyed off was gone.
    it('closes the menu once the "/" is backspaced away', async () => {
      const { user } = renderManager(buildManager([], true));

      await user.type(trailingTextbox(), '/');
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.type(trailingTextbox(), '{Backspace}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    // The reader should not have to finish or commit a paragraph before starting the next one.
    it('reveals a second, empty trailing cell as soon as the first has content', async () => {
      const { user } = renderManager(buildManager([], true));

      await user.type(trailingTextbox(), 'Hello');

      const editors = screen.getAllByRole('textbox', { name: 'Markdown' });
      expect(editors).toHaveLength(2);
      expect(editors[1]).toHaveValue('');
    });

    // Pins the fix from earlier this session: the "/" itself is committed to the cell like any other
    // keystroke (so the underlying editor can reconcile it away again once a type is picked, rather
    // than leaving a stray "/" behind) — which means it reveals a further trailing cell exactly the
    // same way any other first keystroke does. That's a deliberate side effect, not a special case.
    it('reveals a further cell from a lone "/" the same way any other keystroke does', async () => {
      const { user } = renderManager(buildManager([], true));

      await user.type(trailingTextbox(), '/');

      expect(screen.getAllByRole('textbox', { name: 'Markdown' })).toHaveLength(2);
    });

    // Moving on to type in the revealed sibling must not disturb its own content or focus — and, since
    // that sibling is now itself the trailing cell, typing into it reveals a third one in turn.
    it('keeps typing into each newly revealed trailing cell without disturbing the others', async () => {
      const { manager, user } = renderManager(buildManager([], true));

      await user.type(trailingTextbox(), 'Hello');
      const sibling = screen.getAllByRole('textbox', { name: 'Markdown' })[1];
      await user.type(sibling, 'World');

      expect(cellNames(manager)).toEqual(['paragraph-1', 'paragraph-2', 'paragraph-3']);
      expect(manager.state.cells[0].state.content).toEqual({ kind: 'Markdown', spec: { text: 'Hello' } });
      const editors = screen.getAllByRole('textbox', { name: 'Markdown' });
      expect(editors).toHaveLength(3);
      const worldEditor = editors.find((editor) => (editor as HTMLTextAreaElement).value === 'World');
      expect(worldEditor).toHaveFocus();
    });

    // Picking a type that keeps content.kind the same (Paragraph, Heading) converts the trailing cell
    // in place and returns focus to it — the focusRequestId nonce-refire fix from earlier this session.
    // Typing the "/" already revealed a second trailing cell (see the previous test), so there are two
    // by the time the pick happens — the caret belongs on the first, the one that was actually picked.
    it('converts the trailing cell in place and keeps the caret on it', async () => {
      const { manager, user } = renderManager(buildManager([], true));

      await user.type(trailingTextbox(), '/');
      await user.click(screen.getByRole('menuitem', { name: 'Paragraph' }));

      expect(cellNames(manager)).toEqual(['paragraph-1', 'paragraph-2']);
      await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Markdown' })[0]).toHaveFocus());
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

    // renderNotebook's two given cells plus the trailing-invariant cell the bootstrap effect appends
    // after them (its last cell — the collapsed panel — is not an empty markdown cell either).
    it('offers duplicate and delete on every cell in edit mode', () => {
      renderNotebook(true);

      expect(screen.getAllByRole('button', { name: 'Duplicate block' })).toHaveLength(3);
      expect(screen.getAllByRole('button', { name: 'Delete block' })).toHaveLength(3);
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
      // Plus the trailing-invariant cell appended after 'c' (not an empty markdown cell itself).
      expect(cellNames(manager)).toEqual(['a', 'b', 'c', 'paragraph-1']);
    });

    it('deletes the cell it belongs to once confirmed', async () => {
      const publish = jest.spyOn(appEvents, 'publish');
      const { manager } = renderManager(buildManager(buildNarrativeCells(['a', 'b', 'c']), true));

      await reachActions().click(screen.getAllByRole('button', { name: 'Delete block' })[1]);
      act(() => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (publish.mock.calls[0][0] as ShowConfirmModalEvent).payload.onConfirm?.();
      });

      expect(cellNames(manager)).toEqual(['a', 'c', 'paragraph-1']);
    });

    it('duplicates the cell directly below itself', async () => {
      const { manager } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));

      await reachActions().click(screen.getAllByRole('button', { name: 'Duplicate block' })[0]);

      // Plus the trailing-invariant cell appended after 'b'.
      expect(cellNames(manager)).toEqual(['a', 'a-copy-1', 'b', 'paragraph-1']);
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
    async function pickCode(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
      await user.click(trigger);
      await user.click(screen.getByRole('menuitem', { name: 'Code' }));
    }

    async function pickParagraph(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
      await user.click(trigger);
      await user.click(screen.getByRole('menuitem', { name: 'Paragraph' }));
    }

    async function pickHeading(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
      await user.click(trigger);
      await user.click(screen.getByRole('menuitem', { name: 'Heading' }));
    }

    // The trailing empty cell every notebook always has is a markdown cell in its own right, not a
    // button — typing "/" into it opens the same menu the dividers open by clicking "Add block", but
    // picking a type from it converts *that* cell in place (see NotebookCellRenderer's handlePick)
    // rather than inserting a fresh one alongside it the way a divider does. Always re-queries the
    // *current* last "Markdown" textbox rather than caching one, since the trailing-invariant may have
    // already appended a new one by the time this runs.
    async function pickFromTrailingCellMenu(user: ReturnType<typeof userEvent.setup>, itemName: string) {
      const editors = screen.getAllByRole('textbox', { name: 'Markdown' });
      await user.type(editors[editors.length - 1], '/');
      await user.click(screen.getByRole('menuitem', { name: itemName }));
    }

    // A divider belongs to the cell above it, so the one inside cell 'a' inserts between 'a' and 'b'.
    // The leading divider comes first in the DOM, so index 1 is cell 'a' s own divider. 'paragraph-1'
    // is the trailing-invariant cell the bootstrap effect appends after 'b' before any of this happens.
    it('inserts an empty code cell where the divider offered it', async () => {
      const { manager, user } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));

      await pickCode(user, screen.getAllByRole('button', { name: 'Add block' })[1]);

      expect(cellNames(manager)).toEqual(['a', 'code-1', 'b', 'paragraph-1']);
      expect(manager.state.cells[1].state.content).toEqual({ kind: 'Code', spec: { language: '', code: '' } });
      // Inserted because a person asked for it, not because the assistant proposed it.
      expect(manager.state.cells[1].state.source).toBe('user');
    });

    // The divider after the trailing empty cell is offering to insert *past* it. Inserting after
    // that slot would leave it stranded mid-document once the invariant appends a replacement;
    // inserting before it keeps the empty cell at the tail and still records an "Add block".
    it('inserts before the trailing empty slot when the divider offers a position past it', async () => {
      const { manager, user } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));
      const dividers = screen.getAllByRole('button', { name: 'Add block' });

      await pickCode(user, dividers[dividers.length - 1]);

      expect(cellNames(manager)).toEqual(['a', 'b', 'code-1', 'paragraph-1']);
      expect(manager.state.cells[2].state.content).toEqual({ kind: 'Code', spec: { language: '', code: '' } });
      expect(manager.state.cells[3].state.content).toEqual({ kind: 'Markdown', spec: { text: '' } });
    });

    // Same insert-before-trailing path as Code above — Paragraph's starter content is already
    // empty markdown, identical to the trailing slot, so a convert-in-place used to be a no-op
    // on the undo stack. A fresh cell still has to land before the slot.
    it('inserts a paragraph before the trailing empty slot when the divider offers a position past it', async () => {
      const { manager, user } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));
      const dividers = screen.getAllByRole('button', { name: 'Add block' });

      await pickParagraph(user, dividers[dividers.length - 1]);

      expect(cellNames(manager)).toEqual(['a', 'b', 'paragraph-2', 'paragraph-1']);
      expect(manager.state.cells[2].state.content).toEqual({ kind: 'Markdown', spec: { text: '' } });
      expect(manager.state.cells[3].state.content).toEqual({ kind: 'Markdown', spec: { text: '' } });
    });

    it('inserts above the first cell from the leading divider', async () => {
      const { manager, user } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));

      await pickCode(user, screen.getAllByRole('button', { name: 'Add block' })[0]);

      expect(cellNames(manager)).toEqual(['code-1', 'a', 'b', 'paragraph-1']);
    });

    // Typing the "/" is itself a real keystroke now (see the "trailing empty cell" describe above), so
    // it reveals a second trailing cell before the pick ever happens — the conversion lands on the
    // first one, which keeps the name ('paragraph-1') the invariant already gave it rather than a
    // fresh 'code-1' a divider-triggered insert would use.
    it('converts the trailing cell in place from its own menu, rather than inserting a fresh one', async () => {
      const { manager, user } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));

      await pickFromTrailingCellMenu(user, 'Code');

      expect(cellNames(manager)).toEqual(['a', 'b', 'paragraph-1', 'paragraph-2']);
      expect(manager.state.cells[2].state.content).toEqual({ kind: 'Code', spec: { language: '', code: '' } });
    });

    // The trailing-invariant bootstrap is the only affordance an empty notebook has, so this is the
    // sole path to a first cell.
    it('gives an empty notebook its first cell', async () => {
      const { manager, user } = renderManager(buildManager([], true));

      await pickFromTrailingCellMenu(user, 'Code');

      expect(cellNames(manager)).toEqual(['paragraph-1', 'paragraph-2']);
      expect(manager.state.cells[0].state.content).toEqual({ kind: 'Code', spec: { language: '', code: '' } });
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

      await pickFromTrailingCellMenu(user, 'Code');

      expect(await screen.findByRole('textbox', { name: 'Code' })).not.toHaveAttribute('readonly');
      expect(screen.getByRole('combobox', { name: 'Code language' })).toBeInTheDocument();
    });

    // The reader asked for a block, so the caret belongs in it rather than one click away. It is also
    // a race the cell has to win: the block menu hands focus back to the button that opened it as it
    // closes.
    it('hands the caret to the new cell', async () => {
      const { user } = renderManager(buildManager([], true));

      await pickFromTrailingCellMenu(user, 'Code');

      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Code' })).toHaveFocus());
    });

    // Only the newest one: every earlier cell keeps its content but gives up the caret, so a second
    // insertion does not leave two editors fighting over it.
    it('moves the caret on to the next cell it inserts', async () => {
      const { user } = renderManager(buildManager([], true));

      // Waits for the first cell's own (frame-deferred) focus request to land before the second
      // insertion starts — otherwise both requests are in flight at once and can settle in either order.
      await pickFromTrailingCellMenu(user, 'Code');
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Code' })).toHaveFocus());

      await pickFromTrailingCellMenu(user, 'Code');

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

    // Heading and paragraph are both markdown cells under the hood — the menu offers them separately
    // because that's how a reader thinks about what they're adding. 'paragraph-1' at the end is the
    // trailing-invariant cell the bootstrap effect already appended after 'b'.
    it('inserts a heading cell seeded with a heading marker', async () => {
      const { manager, user } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));

      await pickHeading(user, screen.getAllByRole('button', { name: 'Add block' })[1]);

      expect(cellNames(manager)).toEqual(['a', 'heading-1', 'b', 'paragraph-1']);
      expect(manager.state.cells[1].state.content).toEqual({ kind: 'Markdown', spec: { text: '# ' } });
    });

    // Unlike 'heading-1' above, this insert's own default name collides with the trailing-invariant
    // cell's — 'paragraph-1' is already taken by the time this happens, so nextElementName gives the
    // newly-inserted cell 'paragraph-2' instead, even though it lands earlier in the list.
    it('inserts an empty paragraph cell', async () => {
      const { manager, user } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));

      await pickParagraph(user, screen.getAllByRole('button', { name: 'Add block' })[1]);

      expect(cellNames(manager)).toEqual(['a', 'paragraph-2', 'b', 'paragraph-1']);
      expect(manager.state.cells[1].state.content).toEqual({ kind: 'Markdown', spec: { text: '' } });
    });

    // The cell arrives editable and focused, same as a freshly inserted code cell. There are two
    // "Markdown" textboxes once it lands — the new cell and the prompt itself, reset to empty and
    // still present for the next block — so this checks that one of them has the caret, not a specific
    // one by role name alone.
    it('renders a freshly inserted paragraph cell as an editable, focused markdown editor', async () => {
      const { user } = renderManager(buildManager([], true));

      await pickFromTrailingCellMenu(user, 'Paragraph');

      await waitFor(() => {
        const editors = screen.getAllByRole('textbox', { name: 'Markdown' });
        expect(editors.some((editor) => editor === document.activeElement)).toBe(true);
      });
    });

    // Visualization is not buildable yet — its menu entry is a "Coming soon" submenu, not a pick.
    it('leaves the block types it cannot build yet alone', () => {
      const manager = buildManager(buildNarrativeCells(['a']));

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
    // handle announceable at all. Three, not two: the trailing-invariant cell the bootstrap effect
    // appends after renderNotebook's two given cells is a real cell, with its own handle.
    it('renders a named drag handle per cell in edit mode', () => {
      renderNotebook(true);

      expect(screen.getAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(3);
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

    // Plus the trailing-invariant cell the bootstrap effect appends after 'c'.
    expect(cellNames(manager)).toEqual(['b', 'a', 'c', 'paragraph-1']);
  });

  describe('setTagsFromHeader', () => {
    /**
     * The header edits tags, the scene owns them, and the manager is the only thing between the two.
     * Both readers of that walk are exercised elsewhere by their own effects; this is the one that had
     * nothing on it, so a silent no-op here would have left tag editing dead with a green suite.
     */
    it('forwards the edit up to the scene, which owns the tags', () => {
      const manager = buildManager([]);
      const scene = attachScene(manager);

      manager.setTagsFromHeader(['latency', 'slo']);

      expect(scene.state.tags).toEqual(['latency', 'slo']);
    });

    // duplicate(), the deserializer and most of this file build a manager with no scene above it. The
    // edit has nowhere to go, and the manager must not write its own copy instead - the scene is the
    // single writer, and a second copy here is exactly the drift this arrangement exists to prevent.
    it('leaves a manager with no scene above it untouched', () => {
      const manager = buildManager([]);

      manager.setTagsFromHeader(['latency']);

      expect(manager.state.tags).toEqual(['incident', 'checkout']);
    });
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

    // The divider below the trailing empty slot offers index === cells.length. Converting that
    // slot in place (convertCell) used to skip executeEdit: Paragraph only called appendSystemCell
    // (off the stack, so Undo did nothing) and Heading/Code landed as an "Edit block" that restored
    // empty markdown instead of removing the added block.
    it.each([
      {
        type: 'paragraph' as const,
        addedName: 'paragraph-2',
        content: { kind: 'Markdown' as const, spec: { text: '' } },
      },
      {
        type: 'heading' as const,
        addedName: 'heading-1',
        content: { kind: 'Markdown' as const, spec: { text: '# ' } },
      },
      {
        type: 'code' as const,
        addedName: 'code-1',
        content: { kind: 'Code' as const, spec: { language: '', code: '' } },
      },
    ])('undoes a $type block added past the trailing empty slot as Add block', ({ type, addedName, content }) => {
      const cells = [
        ...buildNarrativeCells(['a', 'b']),
        new NotebookCellItem({
          elementName: 'paragraph-1',
          source: 'user',
          content: { kind: 'Markdown', spec: { text: '' } },
        }),
      ];
      const { manager, history } = withHistory(cells);

      const added = manager.addCell(type, cells.length);

      expect(history.state.undoLabel).toBe('Add block');
      expect(cellNames(manager)).toEqual(['a', 'b', addedName, 'paragraph-1']);
      expect(added?.state.content).toEqual(content);

      history.undo();
      expect(cellNames(manager)).toEqual(['a', 'b', 'paragraph-1']);
      expect(manager.state.cells[2].state.content).toEqual({ kind: 'Markdown', spec: { text: '' } });

      history.redo();
      expect(manager.state.cells[2]).toBe(added);
      expect(cellNames(manager)).toEqual(['a', 'b', addedName, 'paragraph-1']);
    });

    // Enter's "split into a new block" gesture. Undoing only removes the split-off cell here — the
    // original cell's own text truncation is a separate, earlier "Edit block" step (see setCellContent),
    // the same way duplicateCell's insert is its own step distinct from any edit before it.
    it('undoes and redoes a split (insertCellAfter)', () => {
      const cells = buildNarrativeCells(['a']);
      const { manager, history } = withHistory(cells);

      const created = manager.insertCellAfter(cells[0]);
      expect(cellNames(manager)).toEqual(['a', created?.state.elementName]);

      history.undo();
      expect(cellNames(manager)).toEqual(['a']);

      history.redo();
      expect(manager.state.cells[1]).toBe(created);
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

// What NotebookLayoutManagerRenderer's onAdvance hands to insertCellAfter on Enter — pulled out here
// since MarkdownCell's own Enter binding lives inside a real CodeMirror keymap, which this file's
// mocked CodeMirrorEditor never actually runs (see the mock's own doc comment above).
describe('splitSeed', () => {
  it('defers to insertCellAfter’s own empty-paragraph default outside a list', () => {
    expect(splitSeed('', undefined)).toEqual({ text: undefined, caretOffset: 0 });
  });

  it('carries a plain paragraph’s leftover text as-is, uncontaminated by any marker', () => {
    expect(splitSeed('rest of the sentence', undefined)).toEqual({ text: 'rest of the sentence', caretOffset: 0 });
  });

  it('seeds a fresh empty item when Enter lands at the end of the list', () => {
    expect(splitSeed('', '- ')).toEqual({ text: '- ', caretOffset: 2 });
  });

  it('prefixes the marker onto text left on the caret’s own line', () => {
    expect(splitSeed('rest of the item', '- ')).toEqual({ text: '- rest of the item', caretOffset: 2 });
  });

  // The bug: Enter at the end of an item that already has further items below it (typed into this
  // same cell via Shift+Enter) used to glue the marker onto the *whole* remainder, prefixing a stray
  // empty item ahead of the next one instead of just handing it over.
  it('hands a later, already-marked item over untouched instead of prefixing it with an empty one', () => {
    expect(splitSeed('\n- item three', '- ')).toEqual({ text: '- item three', caretOffset: 0 });
  });

  it('still prefixes the marker when the caret’s own line has text ahead of later items', () => {
    expect(splitSeed('rest of item two\n- item three', '- ')).toEqual({
      text: '- rest of item two\n- item three',
      caretOffset: 2,
    });
  });
});
