import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { render, screen } from '@testing-library/react';

import { DataLinksListItem, DataLinksListItemProps } from './DataLinksListItem';

const baseLink = {
  url: '',
  title: '',
  onBuildUrl: jest.fn(),
  onClick: jest.fn(),
};

function setupTestContext(options: Partial<DataLinksListItemProps>) {
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
  const { rerender } = render(
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

  return { rerender, props };
}

describe('DataLinksListItem', () => {
  describe('when link has title', () => {
    it('then the link title should be visible', () => {
      const item = {
        ...baseLink,
        title: 'Some Data Link Title',
      };
      setupTestContext({ item });

      expect(screen.getByText(/some data link title/i)).toBeInTheDocument();
    });
  });

  describe('when link has url', () => {
    it('then the link url should be visible', () => {
      const item = {
        ...baseLink,
        url: 'http://localhost:3000',
      };
      setupTestContext({ item });

      expect(screen.getByText(/http:\/\/localhost\:3000/i)).toBeInTheDocument();
      expect(screen.getByTitle(/http:\/\/localhost\:3000/i)).toBeInTheDocument();
    });
  });
});
