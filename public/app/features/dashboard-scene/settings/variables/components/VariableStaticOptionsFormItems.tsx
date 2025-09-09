import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';

import { Stack } from '@grafana/ui';

import {
  VariableStaticOptionsFormItem,
  VariableStaticOptionsFormItemEditor,
} from './VariableStaticOptionsFormItemEditor';

interface VariableStaticOptionsFormProps {
  items: VariableStaticOptionsFormItem[];
  onChange: (items: VariableStaticOptionsFormItem[]) => void;
  width?: number;
}

export function VariableStaticOptionsFormItems({ items, onChange, width }: VariableStaticOptionsFormProps) {
  const handleReorder = (result: DropResult) => {
    if (!result || !result.destination) {
      return;
    }

    const startIdx = result.source.index;
    const endIdx = result.destination.index;

    if (startIdx === endIdx) {
      return;
    }

    const newItems = [...items];
    const [removedItem] = newItems.splice(startIdx, 1);
    newItems.splice(endIdx, 0, removedItem);
    onChange(newItems);
  };

  const handleChange = (item: VariableStaticOptionsFormItem) => {
    const idx = items.findIndex((currentItem) => currentItem.id === item.id);

    if (idx === -1) {
      return;
    }

    const newOptions = [...items];
    newOptions[idx] = item;
    onChange(newOptions);
  };

  const handleRemove = (item: VariableStaticOptionsFormItem) => {
    const newOptions = items.filter((currentItem) => currentItem.id !== item.id);
    onChange(newOptions);
  };

  return (
    <DragDropContext onDragEnd={handleReorder}>
      <Droppable droppableId="static-options-list" direction="vertical">
        {(droppableProvided) => (
          <Stack
            direction="column"
            gap={2}
            width={width}
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
          >
            {items.map((item, idx) => (
              <VariableStaticOptionsFormItemEditor
                item={item}
                index={idx}
                onChange={handleChange}
                onRemove={handleRemove}
                key={item.id}
              />
            ))}
            {droppableProvided.placeholder}
          </Stack>
        )}
      </Droppable>
    </DragDropContext>
  );
}
