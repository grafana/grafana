import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataLink } from '@grafana/data';

import { DataLinksInlineEditorBase } from './DataLinksInlineEditorBase';

const mockChildren = jest.fn((_item, _index, onSave, onCancel) => (
  <div>
    <button onClick={() => onSave(_index, { title: 'Saved', url: '/saved' })}>Mock Save</button>
    <button onClick={() => onCancel(_index)}>Mock Cancel</button>
  </div>
));

function setup(items?: DataLink[]) {
  const onChange = jest.fn();
  render(
    <DataLinksInlineEditorBase<DataLink> type="link" items={items} onChange={onChange} data={[]}>
      {mockChildren}
    </DataLinksInlineEditorBase>
  );
  return { onChange };
}

describe('DataLinksInlineEditorBase', () => {
  it('renders existing items', () => {
    setup([
      { title: 'Link A', url: '/a' },
      { title: 'Link B', url: '/b' },
    ]);

    expect(screen.getByText('Link A')).toBeInTheDocument();
    expect(screen.getByText('Link B')).toBeInTheDocument();
  });

  it('opens add modal when add button is clicked', async () => {
    setup();

    await userEvent.click(screen.getByText('Add link'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add link' })).toBeInTheDocument();
  });

  it('opens edit modal when edit button is clicked', async () => {
    setup([{ title: 'My Link', url: '/link' }]);

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit link' })).toBeInTheDocument();
  });

  it('calls onChange without the removed item', async () => {
    const { onChange } = setup([
      { title: 'Keep', url: '/keep' },
      { title: 'Remove', url: '/remove' },
    ]);

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await userEvent.click(removeButtons[1]);

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ title: 'Keep' })]);
  });

  it('does not call onChange when saving a new item with empty title and url', async () => {
    const mockEmptyChildren = jest.fn((_item, _index, onSave) => (
      <button onClick={() => onSave(_index, { title: '', url: '' })}>Mock Save</button>
    ));

    const onChange = jest.fn();
    render(
      <DataLinksInlineEditorBase<DataLink> type="link" items={[]} onChange={onChange} data={[]}>
        {mockEmptyChildren}
      </DataLinksInlineEditorBase>
    );

    await userEvent.click(screen.getByText('Add link'));
    await userEvent.click(screen.getByText('Mock Save'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
