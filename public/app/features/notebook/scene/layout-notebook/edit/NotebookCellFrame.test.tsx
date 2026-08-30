import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { fireEvent, render, screen } from 'test/test-utils';

import { NotebookCellItem } from '../NotebookCellItem';

import { getCellDropIndicator, NotebookCellFrame, type NotebookDragState } from './NotebookCellFrame';

function buildCell() {
  return new NotebookCellItem({
    elementName: 'md1',
    source: 'user',
    content: { kind: 'Markdown', spec: { text: 'Hello notebook' } },
  });
}

// Collapsed and Panel cells have no caret of their own, so the frame itself is what ArrowUp/Down and
// a focus grant land on — see NotebookCellFrame's own `isEditorCell`.
function buildCollapsedCell() {
  return new NotebookCellItem({ elementName: 'hidden-panel', source: 'user', collapsed: true });
}

interface FrameProps {
  cell?: NotebookCellItem;
  index?: number;
  isEditing?: boolean;
  autoFocus?: boolean;
  focusRequestId?: number;
  onAdd?: (type: string, index: number) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onNavigate?: (direction: 'up' | 'down') => void;
}

// Draggable throws outside a DragDropContext, so the frame always needs the dnd wrappers around it.
// A plain function (rather than render() directly) so a test that needs `rerender` — a fresh focus
// grant arriving on an already-mounted, non-editor cell — can build the same tree with new props.
function frameTree({
  cell = buildCell(),
  index = 1,
  isEditing,
  autoFocus,
  focusRequestId,
  onAdd,
  onDuplicate,
  onDelete,
  onNavigate,
}: FrameProps = {}) {
  return (
    <DragDropContext onDragEnd={() => {}}>
      <Droppable droppableId="test">
        {(dropProvided) => (
          <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
            <NotebookCellFrame
              cell={cell}
              index={index}
              isEditing={isEditing}
              autoFocus={autoFocus}
              focusRequestId={focusRequestId}
              onAdd={onAdd}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onNavigate={onNavigate}
            />
            {dropProvided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

function renderFrame(props?: FrameProps) {
  return render(frameTree(props));
}

describe('NotebookCellFrame', () => {
  it('renders the cell content outside edit mode', async () => {
    renderFrame();

    expect(await screen.findByText('Hello notebook')).toBeInTheDocument();
  });

  it('renders no affordances outside edit mode', () => {
    renderFrame();

    expect(screen.queryByRole('button', { name: 'Drag to reorder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add block' })).not.toBeInTheDocument();
  });

  it('renders the handle and the insertion point in edit mode', async () => {
    renderFrame({ isEditing: true });

    expect(await screen.findByText('Hello notebook')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag to reorder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add block' })).toBeInTheDocument();
  });

  // The only behavioural pin on the insertion index. A divider belongs to the cell above it, so the
  // frame at position i hands its divider i + 1; an off-by-one here would silently insert blocks in
  // the wrong place once edit mode wires onAdd up.
  it('offers the insertion point below its own cell', async () => {
    const onAdd = jest.fn();
    const { user } = renderFrame({ index: 1, isEditing: true, onAdd });

    await user.click(screen.getByRole('button', { name: 'Add block' }));
    await user.click(screen.getByRole('menuitem', { name: 'Heading' }));

    expect(onAdd).toHaveBeenCalledWith('heading', 2);
  });

  // The actions bar is positioned above this frame's box, over the previous cell's insertion divider.
  // Hidden but hit-testable, it would swallow clicks meant for that divider's Add block button, so the
  // hidden state has to be inert and not merely invisible. jsdom does no hit-testing, so this pins the
  // declaration rather than the collision.
  it('makes the hidden actions bar inert', async () => {
    renderFrame({ isEditing: true, onDuplicate: () => {}, onDelete: () => {} });

    const actions = (await screen.findByRole('button', { name: 'Duplicate block' })).parentElement;

    expect(getComputedStyle(actions!).pointerEvents).toBe('none');
  });

  // A Panel or Collapsed cell has no caret of its own to hand ArrowUp/Down or a focus grant to, so
  // the frame itself stands in for both — a Markdown/Code cell's own editor does this instead (see
  // MarkdownCell/CodeCell's own navigationKeymap and useFocusExtension), so the frame never needs to.
  describe('a cell with no caret of its own', () => {
    it('is a tab stop while editing', () => {
      renderFrame({ cell: buildCollapsedCell(), isEditing: true });

      expect(screen.getByText('hidden-panel').closest('[tabindex]')).toHaveAttribute('tabindex', '0');
    });

    it('is not a tab stop while reading', () => {
      renderFrame({ cell: buildCollapsedCell(), isEditing: false });

      expect(screen.getByText('hidden-panel').closest('[tabindex]')).toBeNull();
    });

    it('keeps the drag handle outside the content wrapper the focus ring targets', () => {
      renderFrame({ cell: buildCollapsedCell(), isEditing: true });

      const handle = screen.getByRole('button', { name: 'Drag to reorder' });
      const content = screen.getByText('hidden-panel').closest('.notebook-cell-content');

      expect(content).not.toBeNull();
      expect(content?.contains(handle)).toBe(false);
    });

    it('reports ArrowUp/ArrowDown once the frame itself has focus', () => {
      const onNavigate = jest.fn();
      renderFrame({ cell: buildCollapsedCell(), isEditing: true, onNavigate });
      const frame = screen.getByText('hidden-panel').closest('[tabindex]') as HTMLElement;

      fireEvent.keyDown(frame, { key: 'ArrowDown' });
      fireEvent.keyDown(frame, { key: 'ArrowUp' });

      expect(onNavigate).toHaveBeenNthCalledWith(1, 'down');
      expect(onNavigate).toHaveBeenNthCalledWith(2, 'up');
    });

    // Never for a key that bubbles up from something interactive inside the cell (a panel's own
    // legend or menu button, say) — only the bare frame owns arrow keys.
    it('ignores an arrow key that bubbles up from something inside the cell', () => {
      const onNavigate = jest.fn();
      renderFrame({ cell: buildCollapsedCell(), isEditing: true, onNavigate });

      fireEvent.keyDown(screen.getByText('hidden-panel'), { key: 'ArrowDown' });

      expect(onNavigate).not.toHaveBeenCalled();
    });

    it.each([{ ctrlKey: true }, { altKey: true }, { shiftKey: true }, { metaKey: true }])(
      'ignores an arrow key held with a modifier (%o)',
      (modifier) => {
        const onNavigate = jest.fn();
        renderFrame({ cell: buildCollapsedCell(), isEditing: true, onNavigate });
        const frame = screen.getByText('hidden-panel').closest('[tabindex]') as HTMLElement;

        fireEvent.keyDown(frame, { key: 'ArrowDown', ...modifier });

        expect(onNavigate).not.toHaveBeenCalled();
      }
    );

    it('labels the frame with the cell element name for an assistive-technology user', () => {
      renderFrame({ cell: buildCollapsedCell(), isEditing: true });

      expect(screen.getByRole('group', { name: 'Collapsed block: hidden-panel' })).toBeInTheDocument();
    });

    it('takes DOM focus once a fresh grant targets it', () => {
      const cell = buildCollapsedCell();
      const { rerender } = render(frameTree({ cell, isEditing: true, focusRequestId: 1 }));
      const frame = screen.getByText('hidden-panel').closest('[tabindex]') as HTMLElement;
      expect(frame).not.toHaveFocus();

      rerender(frameTree({ cell, isEditing: true, focusRequestId: 2 }));

      expect(frame).toHaveFocus();
    });

    it('takes DOM focus once at mount when it was already the target', () => {
      renderFrame({ cell: buildCollapsedCell(), isEditing: true, autoFocus: true });

      expect(screen.getByText('hidden-panel').closest('[tabindex]')).toHaveFocus();
    });

    it('scrolls the frame into view once a fresh grant targets it', () => {
      const cell = buildCollapsedCell();
      const { rerender } = render(frameTree({ cell, isEditing: true, focusRequestId: 1 }));
      const frame = screen.getByText('hidden-panel').closest('[tabindex]') as HTMLElement;
      const scrollIntoView = jest.spyOn(frame, 'scrollIntoView');

      rerender(frameTree({ cell, isEditing: true, focusRequestId: 2 }));

      expect(scrollIntoView).toHaveBeenCalled();
    });

    it('scrolls the frame into view once at mount when it was already the target', () => {
      const scrollIntoView = jest.spyOn(HTMLElement.prototype, 'scrollIntoView');

      renderFrame({ cell: buildCollapsedCell(), isEditing: true, autoFocus: true });

      expect(scrollIntoView).toHaveBeenCalled();
      scrollIntoView.mockRestore();
    });
  });
});

describe('getCellDropIndicator', () => {
  // Dragging down, the cells in between shift up and the gap opens below the destination cell;
  // dragging up they shift down and it opens above it.
  it.each([
    ['marks the bottom edge of the destination when dragging down', { source: 0, destination: 2 }, 2, 'bottom'],
    ['marks the top edge of the destination when dragging up', { source: 2, destination: 0 }, 0, 'top'],
    ['ignores cells that are not the destination', { source: 0, destination: 2 }, 1, undefined],
    ['ignores a drag back to its own position', { source: 1, destination: 1 }, 1, undefined],
    ['ignores a pointer outside the droppable', { source: 1, destination: null }, 1, undefined],
  ])('%s', (_name, drag, index, expected) => {
    expect(getCellDropIndicator(drag as NotebookDragState, index as number)).toBe(expected);
  });

  it('marks nothing when no drag is in flight', () => {
    expect(getCellDropIndicator(null, 0)).toBeUndefined();
  });
});
