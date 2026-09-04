import { type DropResult } from '@hello-pangea/dnd';
import { render, screen, waitFor } from '@testing-library/react';

import { DraggableList } from './DraggableList';

interface TestItem {
  id: string;
  label: string;
}

const items: TestItem[] = [
  { id: 'a', label: 'Item A' },
  { id: 'b', label: 'Item B' },
];

function renderList(isDragDisabled?: boolean) {
  return render(
    <DraggableList<TestItem>
      droppableId="test-droppable"
      items={items}
      keyExtractor={(item) => item.id}
      renderItem={(item) => <span>{item.label}</span>}
      onDragEnd={(_result: DropResult) => {}}
      isDragDisabled={isDragDisabled}
    />
  );
}

// @hello-pangea/dnd only renders the drag handle attributes when dragging is enabled,
// so their presence/absence is what we assert against.
function getDragHandle(label: string): HTMLElement | null {
  return screen.getByText(label).closest('[data-rfd-drag-handle-draggable-id]');
}

describe('DraggableList', () => {
  it('renders every item via renderItem', () => {
    renderList();

    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
  });

  it('enables dragging by default when isDragDisabled is omitted', async () => {
    renderList();

    await waitFor(() => expect(getDragHandle('Item A')).toBeInTheDocument());
  });

  it('enables dragging when isDragDisabled is false', async () => {
    renderList(false);

    await waitFor(() => expect(getDragHandle('Item A')).toBeInTheDocument());
  });

  it('disables dragging when isDragDisabled is true', async () => {
    const { container } = renderList(true);

    await waitFor(() => expect(container.querySelector('[data-rfd-droppable-id]')).toBeInTheDocument());
    expect(getDragHandle('Item A')).not.toBeInTheDocument();
  });
});
