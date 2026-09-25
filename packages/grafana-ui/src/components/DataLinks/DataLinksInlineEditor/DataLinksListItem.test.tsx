import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { render, screen, waitFor } from '@testing-library/react';

import { DataLinksListItem, type DataLinksListItemProps } from './DataLinksListItem';

const baseLink = {
  url: '',
  title: '',
  onBuildUrl: jest.fn(),
  onClick: jest.fn(),
};

async function setupTestContext(options: Partial<DataLinksListItemProps>) {
  const defaults: DataLinksListItemProps = {
    index: 0,
    item: baseLink,
    data: [],
    onChange: jest.fn(),
    onEdit: jest.fn(),
    onRemove: jest.fn(),
    itemKey: 'itemKey',
  };

  const onDragEnd = jest.fn();

  const props = { ...defaults, ...options };
  const { container, rerender } = render(
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="sortable-links" direction="vertical">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            <DataLinksListItem {...props} />
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );

  await waitFor(() => {
    expect(container.querySelectorAll('[data-rfd-drag-handle-draggable-id]')).toHaveLength(1);
  });

  return { rerender, props };
}

describe('DataLinksListItem', () => {
  describe('when link has title', () => {
    it('then the link title should be visible', async () => {
      const item = {
        ...baseLink,
        title: 'Some Data Link Title',
      };
      await setupTestContext({ item });

      // the drag handle icon repeats the title in its <title>, so only look at the visible text
      expect(screen.getByText(/some data link title/i, { selector: 'div' })).toBeInTheDocument();
    });
  });

  describe('when link has url', () => {
    it('then the link url should be visible', async () => {
      const item = {
        ...baseLink,
        url: 'http://localhost:3000',
      };
      await setupTestContext({ item });

      expect(screen.getByText(/http:\/\/localhost\:3000/i)).toBeInTheDocument();
      expect(screen.getByTitle(/http:\/\/localhost\:3000/i)).toBeInTheDocument();
    });
  });
});
