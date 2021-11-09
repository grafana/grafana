import { Button } from '@grafana/ui';
import React from 'react';
import Stack from './Stack';

interface EditorListProps<T> {
  items: T[];
  renderItem: (item: Partial<T>, onChangeItem: (item: T) => void, onDeleteItem: () => void) => React.ReactElement;
  onChange: (items: Array<Partial<T>>) => void;
}

function EditorList<T>({ items, renderItem, onChange }: EditorListProps<T>) {
  const onAddItem = () => {
    const newItems = [...items, {}];

    onChange(newItems);
  };

  const onChangeItem = (itemIndex: number, newItem: T) => {
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
      <Button onClick={onAddItem} variant="secondary" size="md" icon="plus" aria-label="Add" />
    </Stack>
  );
}

export default EditorList;
