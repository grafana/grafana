import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { render, screen } from 'test/test-utils';

import { NotebookCellItem } from '../NotebookCellItem';

import { getCellDropIndicator, NotebookCellFrame, type NotebookDragState } from './NotebookCellFrame';

function buildCell() {
  return new NotebookCellItem({
    elementName: 'md1',
    source: 'user',
    content: { kind: 'Markdown', spec: { text: 'Hello notebook' } },
  });
}

// Draggable throws outside a DragDropContext, so the frame always needs the dnd wrappers around it.
function renderFrame({
  index = 1,
  isEditing,
  onAdd,
  onDuplicate,
  onDelete,
}: {
  index?: number;
  isEditing?: boolean;
  onAdd?: (type: string, index: number) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
} = {}) {
  return render(
    <DragDropContext onDragEnd={() => {}}>
      <Droppable droppableId="test">
        {(dropProvided) => (
          <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
            <NotebookCellFrame
              cell={buildCell()}
              index={index}
              isEditing={isEditing}
              onAdd={onAdd}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
            {dropProvided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
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
