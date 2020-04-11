import React, { useCallback, useMemo } from 'react';
import { css, cx } from 'emotion';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';
import {
  createOrderFieldsComparer,
  DataFrame,
  DataTransformerID,
  GrafanaTheme,
  OrganizeFieldsTransformerOptions,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
} from '@grafana/data';
import { stylesFactory, useTheme } from '../../themes';
import { Button } from '../Button/Button';
import { VerticalGroup } from '../Layout/Layout';
import { Input } from '../Input/Input';

interface OrganizeFieldsTransformerEditorProps extends TransformerUIProps<OrganizeFieldsTransformerOptions> {}

const OrganizeFieldsTransformerEditor: React.FC<OrganizeFieldsTransformerEditorProps> = props => {
  const { options, input, onChange } = props;
  const { indexByName, excludeByName, renameByName } = options;

  const fieldNames = useMemo(() => fieldNamesFromInput(input), [input]);
  const orderedFieldNames = useMemo(() => orderFieldNamesByIndex(fieldNames, indexByName), [fieldNames, indexByName]);

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

  const onRenameField = useCallback(
    (from: string, to: string) => {
      onChange({
        ...options,
        renameByName: {
          ...options.renameByName,
          [from]: to,
        },
      });
    },
    [onChange, fieldNames, renameByName]
  );

  return (
    <VerticalGroup>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="sortable-fields-transformer" direction="vertical">
          {provided => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {orderedFieldNames.map((fieldName, index) => {
                return (
                  <DraggableFieldName
                    fieldName={fieldName}
                    index={index}
                    onToggleVisibility={onToggleVisibility}
                    onRenameField={onRenameField}
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
    </VerticalGroup>
  );
};

interface DraggableFieldProps {
  fieldName: string;
  index: number;
  visible: boolean;
  onToggleVisibility: (fieldName: string, isVisible: boolean) => void;
  onRenameField: (from: string, to: string) => void;
}

const DraggableFieldName: React.FC<DraggableFieldProps> = ({
  fieldName,
  index,
  visible,
  onToggleVisibility,
  onRenameField,
}) => {
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
          <div className={styles.left}>
            <i className={cx('fa fa-ellipsis-v', styles.draggable)} />
            <Button
              className={styles.toggle}
              variant="link"
              size="md"
              icon={visible ? 'eye' : 'eye-slash'}
              onClick={() => onToggleVisibility(fieldName, visible)}
            />
            <span className={styles.name}>{fieldName}</span>
          </div>
          <div className={styles.right}>
            <Input
              placeholder={`Rename ${fieldName}`}
              onChange={event => onRenameField(fieldName, event.currentTarget.value)}
            />
          </div>
        </div>
      )}
    </Draggable>
  );
};

const getFieldNameStyles = stylesFactory((theme: GrafanaTheme) => ({
  container: css`
    display: flex;
    align-items: center;
    margin-top: 8px;
  `,
  left: css`
    width: 35%;
    padding: 0 8px;
    border-radius: 3px;
    background-color: ${theme.isDark ? theme.colors.grayBlue : theme.colors.gray6};
    border: 1px solid ${theme.isDark ? theme.colors.dark6 : theme.colors.gray5};
  `,
  right: css`
    width: 65%;
    margin-left: 8px;
  `,
  toggle: css`
    padding: 5px;
    margin: 0 5px;
  `,
  draggable: css`
    font-size: ${theme.typography.size.md};
    opacity: 0.4;
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

const orderFieldNamesByIndex = (fieldNames: string[], indexByName: Record<string, number> = {}): string[] => {
  if (!indexByName || Object.keys(indexByName).length === 0) {
    return fieldNames;
  }
  const comparer = createOrderFieldsComparer(indexByName);
  return fieldNames.sort(comparer);
};

const fieldNamesFromInput = (input: DataFrame[]): string[] => {
  if (!Array.isArray(input)) {
    return [] as string[];
  }

  return Object.keys(
    input.reduce((names, frame) => {
      if (!frame || !Array.isArray(frame.fields)) {
        return names;
      }

      return frame.fields.reduce((names, field) => {
        names[field.name] = null;
        return names;
      }, names);
    }, {} as Record<string, null>)
  );
};

export const organizeFieldsTransformRegistryItem: TransformerRegistyItem<OrganizeFieldsTransformerOptions> = {
  id: DataTransformerID.organize,
  editor: OrganizeFieldsTransformerEditor,
  transformation: standardTransformers.organizeFieldsTransformer,
  name: 'Organize fields',
  description: 'Order, filter and rename fields',
};
