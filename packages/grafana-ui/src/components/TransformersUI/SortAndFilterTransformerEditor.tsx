import React, { useMemo, useCallback } from 'react';
import { css, cx } from 'emotion';
import { SortAndFilterFieldsTransformerOptions } from '@grafana/data/src/transformations/transformers/sortAndFilter';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { TransformerUIRegistyItem, TransformerUIProps } from './types';
import { DataTransformerID, transformersRegistry, DataFrame, GrafanaTheme } from '@grafana/data';
import { Button } from '../Forms/Button';
import { stylesFactory, useTheme } from '../../themes';

interface SortAndFilterTransformerEditorProps extends TransformerUIProps<SortAndFilterFieldsTransformerOptions> {}

const SortAndFilterTransformerEditor: React.FC<SortAndFilterTransformerEditorProps> = props => {
  const { options, input, onChange } = props;
  const { indexByName, excludeByName } = options;

  const styles = getEditorStyles();
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
    [onChange, excludeByName, indexByName]
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
    [onChange, indexByName, excludeByName, fieldNames]
  );

  return (
    <div className={styles.container}>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="sortable-fields-transformer" direction="horizontal">
          {provided => (
            <div className={styles.fields} ref={provided.innerRef} {...provided.droppableProps}>
              {sortedFieldNames.map((fieldName, index) => {
                return (
                  <DraggableFieldName
                    fieldName={fieldName}
                    index={index}
                    onToggleVisibility={onToggleVisibility}
                    visible={!excludeByName[fieldName]}
                    key={fieldName}
                  />
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

interface DraggableFieldProps {
  fieldName: string;
  index: number;
  visible: boolean;
  onToggleVisibility: (fieldName: string, isVisible: boolean) => void;
}

const DraggableFieldName: React.FC<DraggableFieldProps> = ({ fieldName, index, visible, onToggleVisibility }) => {
  const theme = useTheme();
  const styles = getFieldNameStyles(theme);

  return (
    <Draggable draggableId={fieldName} index={index}>
      {provided => (
        <div
          className={styles.container}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <i className={cx('fa fa-ellipsis-v', styles.draggable)} />
          <Button
            className={styles.toggle}
            variant="link"
            size="md"
            icon={visible ? 'fa fa-eye' : 'fa fa-eye-slash'}
            onClick={() => onToggleVisibility(fieldName, visible)}
          />
          <span className={styles.name}>{fieldName}</span>
        </div>
      )}
    </Draggable>
  );
};

const getEditorStyles = stylesFactory(() => ({
  container: css`
    display: flex;
    flex-direction: column;
  `,
  fields: css`
    flex-grow: 1;
    display: inline-flex;
    overflow: auto;
  `,
}));

const getFieldNameStyles = stylesFactory((theme: GrafanaTheme) => ({
  container: css`
    display: flex;
    align-items: center;
    padding: 0 8px;
    border-radius: 3px;
    background-color: ${theme.isDark ? theme.colors.grayBlue : theme.colors.gray6};
    border: 1px solid ${theme.isDark ? theme.colors.dark6 : theme.colors.gray5};
    margin-right: 8px;
  `,
  toggle: css`
    padding: 5px;
  `,
  draggable: css`
    font-size: ${theme.typography.size.md};
    opacity: 0.6;
  `,
  name: css`
    font-size: ${theme.typography.size.sm};
    font-weight: ${theme.typography.weight.semibold};
  `,
}));

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
