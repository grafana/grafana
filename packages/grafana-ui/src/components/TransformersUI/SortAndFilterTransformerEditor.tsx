import React, { useMemo, useCallback } from 'react';
import { SortAndFilterFieldsTransformerOptions } from '@grafana/data/src/transformations/transformers/sortAndFilter';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { TransformerUIRegistyItem, TransformerUIProps } from './types';
import { DataTransformerID, transformersRegistry, DataFrame } from '@grafana/data';

interface SortAndFilterTransformerEditorProps extends TransformerUIProps<SortAndFilterFieldsTransformerOptions> {}

const SortAndFilterTransformerEditor: React.FC<SortAndFilterTransformerEditorProps> = props => {
  const { options, input, onChange } = props;
  const { indexByName, excludeByName } = options;

  const fieldNames = useMemo(() => fieldNamesFromInput(input), [input]);
  const sortedFieldNames = useMemo(() => sortFieldNamesByIndex(fieldNames, indexByName), [fieldNames, indexByName]);

  const onToggleVisibility = useCallback(
    (field: string, shouldExclude: boolean) => {
      onChange({
        ...options,
        excludeByName: {
          ...excludeByName,
          [field]: shouldExclude,
        },
      });
    },
    [onChange, options]
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result || !result.destination) {
        return;
      }

      const startIndex = result.source.index;
      const endIndex = result.destination.index;

      if (startIndex === endIndex) {
        return;
      }

      onChange({
        ...options,
        indexByName: reorderToIndex(fieldNames, startIndex, endIndex),
      });
    },
    [onChange, options, fieldNames]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="sortable-fields-transformer" direction="horizontal">
        {provided => (
          <div style={{ flexGrow: 1, display: 'inline-flex' }} ref={provided.innerRef} {...provided.droppableProps}>
            {sortedFieldNames.map((fieldName, index) => {
              return (
                <DraggableFieldName
                  fieldName={fieldName}
                  index={index}
                  onToggleVisibility={onToggleVisibility}
                  visible={!excludeByName[fieldName]}
                />
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

interface DraggableFieldProps {
  fieldName: string;
  index: number;
  visible: boolean;
  onToggleVisibility: (fieldName: string, isVisible: boolean) => void;
}

const DraggableFieldName: React.FC<DraggableFieldProps> = ({ fieldName, index, visible, onToggleVisibility }) => {
  return (
    <Draggable draggableId={fieldName} index={index}>
      {provided => (
        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
          <i
            className={visible ? 'fa fa-eye' : 'fa fa-eye-slash'}
            onClick={() => onToggleVisibility(fieldName, !visible)}
          />
          <span>{fieldName}</span>
        </div>
      )}
    </Draggable>
  );
};

const reorderToIndex = (fieldNames: string[], startIndex: number, endIndex: number) => {
  const result = Array.from(fieldNames);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result.reduce((nameByIndex, fieldName, index) => {
    nameByIndex[fieldName] = index;
    return nameByIndex;
  }, {} as Record<string, number>);
};

const sortFieldNamesByIndex = (fieldNames: string[], indexByName: Record<string, number> = {}): string[] => {
  if (Object.keys(indexByName).length === 0) {
    return fieldNames;
  }

  return fieldNames.sort((a, b) => {
    const aIndex = indexByName[a] || 0;
    const bIndex = indexByName[b] || 0;
    return aIndex - bIndex;
  });
};

const fieldNamesFromInput = (input: DataFrame[]): string[] => {
  return Object.keys(
    input.reduce((names, frame) => {
      return frame.fields.reduce((names, field) => {
        names[field.name] = null;
        return names;
      }, names);
    }, {} as Record<string, null>)
  );
};

export const sortAndFilterTransformRegistryItem: TransformerUIRegistyItem<SortAndFilterFieldsTransformerOptions> = {
  id: DataTransformerID.sortAndFilter,
  component: SortAndFilterTransformerEditor,
  transformer: transformersRegistry.get(DataTransformerID.sortAndFilter),
  name: 'Sort and filter',
  description: 'UI for sorting and hiding fields',
};
