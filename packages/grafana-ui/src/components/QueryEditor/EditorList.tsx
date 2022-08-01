import React from 'react';

import { Button } from '../Button';

import { Stack } from './Stack';

interface EditorListProps<T> {
  items: Array<Partial<T>>;
  renderItem: (
    item: Partial<T>,
    onChangeItem: (item: Partial<T>) => void,
    onDeleteItem: () => void
  ) => React.ReactElement;
  onChange: (items: Array<Partial<T>>) => void;
}

export function EditorList<T>({ items, renderItem, onChange }: EditorListProps<T>) {
  const onAddItem = () => {
    const newItems = [...items, {}];

    onChange(newItems);
  };

  const onChangeItem = (itemIndex: number, newItem: Partial<T>) => {
    const newItems = [...items];
    newItems[itemIndex] = newItem;
    onChange(newItems);
  };

  const onDeleteItem = (itemIndex: number) => {
    const newItems = [...items];
    newItems.splice(itemIndex, 1);
    onChange(newItems);
  };
  return (
    <Stack>
      {items.map((item, index) => (
        <div key={index}>
          {renderItem(
            item,
            (newItem) => onChangeItem(index, newItem),
            () => onDeleteItem(index)
          )}
        </div>
      ))}
      <Button onClick={onAddItem} variant="secondary" size="md" icon="plus" aria-label="Add" type="button" />
    </Stack>
  );
}
