import { act, fireEvent, render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { SceneTimeRange, VizPanel } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';
import { type NotebookLayoutKind } from 'app/features/notebook/types';
import { ShowConfirmModalEvent } from 'app/types/events';

// CodeMirror does not run in jsdom; a textarea carries readOnly into the DOM so the edit-mode
// propagation is observable end to end. It stands in for the caret the same way CodeCell.test.tsx
// does — a new `extensions` identity is what rebuilds CodeMirror's view plugins — which makes the
// manager -> frame -> renderer -> cell wiring observable here.
//
// CodeCell passes only its (optional) focus request as `extensions`, so any non-empty array means one
// was made. MarkdownCell always adds its live-preview extension on top of that, so a Markdown
// `extensions` array is never empty even unfocused — the threshold for "a focus request is in there"
// is one entry higher than that baseline (regular cells never get an Enter keymap at all; only
// NotebookAddBlockPrompt's onSubmit adds one, see below).
//
// Real CodeMirrorEditor never sees a raw re-render-fresh `extensions` array either: CodeEditor.tsx
// wraps it in useShallowStable precisely because callers pass inline literals on every render (its own
// doc comment says so). Without reproducing that here, the prompt's own MarkdownCell — always at the
// three-item threshold once it has livePreview, a placeholder and its Enter keymap, even though it
// never actually requests focus through MarkdownCell's own autoFocus prop (it asks CodeMirror directly
// instead — see NotebookAddBlockPrompt's own autoFocus doc comment) — would re-fire this stub's fake
// focus effect on every keystroke, stealing focus back from whatever cell the reader just inserted. A
// fresh prompt slot is excluded outright below rather than folded into the threshold math, since its
// baseline is higher than a regular cell's ever is regardless.
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
      const focusThreshold = ariaLabel === 'Markdown' ? 2 : 1;

      useEffect(() => {
        if (!stableExtensions || stableExtensions.length < focusThreshold) {
          return;
        }
        // See the file-header comment: a prompt's own editor is excluded regardless of threshold.
        if (ref.current?.closest('[data-testid="notebook-add-block-prompt"]')) {
          return;
        }

        const frame = requestAnimationFrame(() => ref.current?.focus());
        return () => cancelAnimationFrame(frame);
      }, [stableExtensions, focusThreshold]);

      return (
        <textarea
          ref={ref}
          aria-label={ariaLabel}
          // Controlled, unlike CodeCell.test.tsx's own stub: the prompt resets its buffer to empty
          // after every commit (see NotebookAddBlockPrompt), and a real CodeMirrorEditor's `value` is
          // genuinely controlled too — an uncontrolled stub would leave stale text in the DOM across
          // that reset, which nothing in a real browser would ever do.
          value={value}
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
    function promptTextbox() {
      return within(screen.getByTestId('notebook-add-block-prompt')).getByRole('textbox', { name: 'Markdown' });
    }

    it('does not offer the prompt outside edit mode', () => {
      renderNotebook();

      expect(screen.queryByTestId('notebook-add-block-prompt')).not.toBeInTheDocument();
    });

    // Unlike the dividers it is not hover-revealed, so it is queryable with no interaction at all —
    // which is the whole point of it.
    it('renders one prompt at the end of the document in edit mode', () => {
      renderNotebook(true);

      expect(screen.getAllByTestId('notebook-add-block-prompt')).toHaveLength(1);
    });

    // Pairs with 'renders no insertion points in an empty notebook' above.
    it('is the only affordance in an empty notebook', () => {
      renderManager(buildManager([], true));

      expect(screen.getByTestId('notebook-add-block-prompt')).toBeInTheDocument();
    });

    // It appends, so unlike a divider it must not be swept along by a cell reorder.
    it('sits outside every cell frame', () => {
      renderNotebook(true);

      expect(screen.getByTestId('notebook-add-block-prompt').closest('[data-rfd-draggable-id]')).toBeNull();
    });

    // The prompt is a markdown cell in its own right, not a button — typing "/" is what opens the menu
    // dividers open by clicking "Add block".
    it('opens the same block type menu as the dividers on a lone "/"', async () => {
      const { user } = renderNotebook(true);

      await user.type(promptTextbox(), '/');

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Heading' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Code' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Visualization' })).toHaveAttribute('aria-haspopup', 'menu');
    });

    // Regular typing (anything but a lone "/") never opens the menu — it is just markdown text.
    it('leaves plain typing alone', async () => {
      const { user } = renderNotebook(true);

      await user.type(promptTextbox(), 'Hello');

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    // Datadog's "type ahead" affordance: the reader should not have to finish or commit a paragraph
    // before starting the next one. An empty notebook, so the prompt is the only markdown editor on
    // screen and the two slots aren't lost among any other cells' own editors.
    it('reveals a second, empty prompt as soon as the first has content', async () => {
      const { user } = renderManager(buildManager([], true));

      await user.type(promptTextbox(), 'Hello');

      expect(screen.getAllByTestId('notebook-add-block-prompt')).toHaveLength(2);
      const editors = screen.getAllByRole('textbox', { name: 'Markdown' });
      expect(editors).toHaveLength(2);
      expect(editors[1]).toHaveValue('');
    });

    it('does not reveal a further prompt from a lone "/"', async () => {
      const { user } = renderManager(buildManager([], true));

      await user.type(promptTextbox(), '/');

      expect(screen.getAllByTestId('notebook-add-block-prompt')).toHaveLength(1);
    });

    // Moving on to type in the revealed sibling retires the original (via its own existing blur-commit)
    // rather than leaving a stack of former prompts behind, and must not disturb the sibling's own
    // content or focus in the process — the exact bug a position-based (rather than stable-id) key
    // would have.
    it('retires the original prompt and keeps exactly two once the reader moves on to the next one', async () => {
      const { manager, user } = renderManager(buildManager([], true));

      await user.type(promptTextbox(), 'Hello');
      const sibling = screen.getAllByRole('textbox', { name: 'Markdown' })[1];
      await user.type(sibling, 'World');

      expect(cellNames(manager)).toEqual(['paragraph-1']);
      expect(manager.state.cells[0].state.content).toEqual({ kind: 'Markdown', spec: { text: 'Hello' } });
      expect(screen.getAllByTestId('notebook-add-block-prompt')).toHaveLength(2);
      const remaining = screen.getAllByRole('textbox', { name: 'Markdown' });
      const worldEditor = remaining.find((editor) => (editor as HTMLTextAreaElement).value === 'World');
      expect(worldEditor).toHaveFocus();
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

    // The end-of-document prompt is a markdown cell, not a button — typing "/" opens the same menu the
    // dividers open by clicking "Add block".
    async function pickFromPromptMenu(user: ReturnType<typeof userEvent.setup>, itemName: string) {
      const prompt = within(screen.getByTestId('notebook-add-block-prompt')).getByRole('textbox', {
        name: 'Markdown',
      });
      await user.type(prompt, '/');
      await user.click(screen.getByRole('menuitem', { name: itemName }));
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

      await pickFromPromptMenu(user, 'Code');

      expect(cellNames(manager)).toEqual(['a', 'b', 'code-1']);
    });

    // The prompt is the only affordance an empty notebook has, so this is the sole path to a first cell.
    it('gives an empty notebook its first cell', async () => {
      const { manager, user } = renderManager(buildManager([], true));

      await pickFromPromptMenu(user, 'Code');

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

      await pickFromPromptMenu(user, 'Code');

      expect(await screen.findByRole('textbox', { name: 'Code' })).not.toHaveAttribute('readonly');
      expect(screen.getByRole('combobox', { name: 'Code language' })).toBeInTheDocument();
    });

    // The reader asked for a block, so the caret belongs in it rather than one click away. It is also
    // a race the cell has to win: the block menu hands focus back to the button that opened it as it
    // closes.
    it('hands the caret to the new cell', async () => {
      const { user } = renderManager(buildManager([], true));

      await pickFromPromptMenu(user, 'Code');

      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Code' })).toHaveFocus());
    });

    // Only the newest one: every earlier cell keeps its content but gives up the caret, so a second
    // insertion does not leave two editors fighting over it.
    it('moves the caret on to the next cell it inserts', async () => {
      const { user } = renderManager(buildManager([], true));

      // Waits for the first cell's own (frame-deferred) focus request to land before the second
      // insertion starts — otherwise both requests are in flight at once and can settle in either order.
      await pickFromPromptMenu(user, 'Code');
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Code' })).toHaveFocus());

      await pickFromPromptMenu(user, 'Code');

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
    // because that's how a reader thinks about what they're adding.
    it('inserts a heading cell seeded with a heading marker', async () => {
      const { manager, user } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));

      await pickHeading(user, screen.getAllByRole('button', { name: 'Add block' })[1]);

      expect(cellNames(manager)).toEqual(['a', 'heading-1', 'b']);
      expect(manager.state.cells[1].state.content).toEqual({ kind: 'Markdown', spec: { text: '# ' } });
    });

    it('inserts an empty paragraph cell', async () => {
      const { manager, user } = renderManager(buildManager(buildNarrativeCells(['a', 'b']), true));

      await pickParagraph(user, screen.getAllByRole('button', { name: 'Add block' })[1]);

      expect(cellNames(manager)).toEqual(['a', 'paragraph-1', 'b']);
      expect(manager.state.cells[1].state.content).toEqual({ kind: 'Markdown', spec: { text: '' } });
    });

    // The cell arrives editable and focused, same as a freshly inserted code cell. There are two
    // "Markdown" textboxes once it lands — the new cell and the prompt itself, reset to empty and
    // still present for the next block — so this checks that one of them has the caret, not a specific
    // one by role name alone.
    it('renders a freshly inserted paragraph cell as an editable, focused markdown editor', async () => {
      const { user } = renderManager(buildManager([], true));

      await pickFromPromptMenu(user, 'Paragraph');

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
