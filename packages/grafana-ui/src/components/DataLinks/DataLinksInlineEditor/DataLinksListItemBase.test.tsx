import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataLink } from '@grafana/data';

import { DataLinksListItemBase, type DataLinksListItemBaseProps } from './DataLinksListItemBase';

function setup(overrides?: Partial<DataLinksListItemBaseProps<DataLink>>) {
  const defaults: DataLinksListItemBaseProps<DataLink> = {
    index: 0,
    item: { title: 'My link', url: 'http://localhost' },
    data: [],
    onChange: jest.fn(),
    onEdit: jest.fn(),
    onRemove: jest.fn(),
    itemKey: 'key-0',
    ...overrides,
  };

  render(
    <DragDropContext onDragEnd={jest.fn()}>
      <Droppable droppableId="test" direction="vertical">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            <DataLinksListItemBase {...defaults} />
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );

  return defaults;
}

describe('DataLinksListItemBase', () => {
  it('renders title and url', () => {
    setup();

    expect(screen.getByText('My link')).toBeInTheDocument();
    expect(screen.getByText('http://localhost')).toBeInTheDocument();
  });

  it('shows placeholder when title is empty', () => {
    setup({ item: { title: '', url: 'http://localhost' } });

    expect(screen.getByText('Title not provided')).toBeInTheDocument();
  });

  it('shows placeholder when url is empty', () => {
    setup({ item: { title: 'Title', url: '' } });

    expect(screen.getByText('Data link url not provided')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = jest.fn();
    setup({ onEdit });

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(onEdit).toHaveBeenCalled();
  });

  it('calls onRemove when remove button is clicked', async () => {
    const onRemove = jest.fn();
    setup({ onRemove });

    await userEvent.click(screen.getByRole('button', { name: /remove/i }));

    expect(onRemove).toHaveBeenCalled();
  });

  it('shows one-click badge when oneClick is true', () => {
    setup({ item: { title: 'Link', url: '/url', oneClick: true } });

    expect(screen.getByText('One click')).toBeInTheDocument();
  });
});
