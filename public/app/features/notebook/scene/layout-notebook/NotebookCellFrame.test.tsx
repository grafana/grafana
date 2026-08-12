import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { render, screen } from 'test/test-utils';

import { getCellDropIndicator, NotebookCellFrame, type NotebookDragState } from './NotebookCellFrame';
import { NotebookCellItem } from './NotebookCellItem';

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
}: {
  index?: number;
  isEditing?: boolean;
  onAdd?: (type: string, index: number) => void;
} = {}) {
  return render(
    <DragDropContext onDragEnd={() => {}}>
      <Droppable droppableId="test">
        {(dropProvided) => (
          <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
            <NotebookCellFrame cell={buildCell()} index={index} isEditing={isEditing} onAdd={onAdd} />
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
