import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SelectionChipList } from './SelectionChipList';

type TestItem = {
  id: string;
  label: string;
};

const buildItems = (prefix: string, count: number): TestItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    label: `${prefix}-${index}`,
  }));

const renderSelectionChipList = (items: TestItem[], onChange = jest.fn()) =>
  render(
    <SelectionChipList
      items={items}
      onChange={onChange}
      getKey={(item) => item.id}
      getLabel={(item) => item.label}
      maxVisibleItems={6}
      clearTitle="Clear Selection"
      clearBody="Are you sure you want to clear all selections?"
    />
  );

describe('SelectionChipList', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders nothing when there are no items', () => {
    renderSelectionChipList([]);

    expect(screen.queryByText('Clear selection')).not.toBeInTheDocument();
    expect(screen.queryByText('Show all')).not.toBeInTheDocument();
  });

  it('shows all items when requested', async () => {
    renderSelectionChipList(buildItems('item', 7));

    expect(screen.queryByText('item-6')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Show all'));

    expect(screen.getByText('item-6')).toBeInTheDocument();
  });

  it('collapses back to the default visible set when the parent items change', async () => {
    const onChange = jest.fn();
    const { rerender } = renderSelectionChipList(buildItems('item', 7), onChange);

    await userEvent.click(screen.getByText('Show all'));
    expect(screen.getByText('item-6')).toBeInTheDocument();

    rerender(
      <SelectionChipList
        items={buildItems('updated', 7)}
        onChange={onChange}
        getKey={(item) => item.id}
        getLabel={(item) => item.label}
        maxVisibleItems={6}
        clearTitle="Clear Selection"
        clearBody="Are you sure you want to clear all selections?"
      />
    );

    expect(screen.queryByText('updated-6')).not.toBeInTheDocument();
    expect(screen.getByText('Show all')).toBeInTheDocument();
  });

  it('clears all items after confirmation', async () => {
    const onChange = jest.fn();
    renderSelectionChipList(buildItems('item', 2), onChange);

    await userEvent.click(screen.getByText('Clear selection'));
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('removes a single item when its chip is clicked', async () => {
    const items = buildItems('item', 3);
    const onChange = jest.fn();
    renderSelectionChipList(items, onChange);

    await userEvent.click(screen.getByRole('button', { name: 'item-1' }));

    expect(onChange).toHaveBeenCalledWith([items[0], items[2]]);
  });
});
