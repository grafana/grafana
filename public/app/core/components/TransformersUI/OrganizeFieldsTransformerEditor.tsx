import React, { useCallback, useMemo } from 'react';
import { css } from 'emotion';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';
import {
  DataFrame,
  DataTransformerID,
  GrafanaTheme,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
  getFieldDisplayName,
} from '@grafana/data';
import { stylesFactory, useTheme, Input, IconButton, Icon } from '@grafana/ui';

import { OrganizeFieldsTransformerOptions } from '@grafana/data/src/transformations/transformers/organize';
import { createOrderFieldsComparer } from '@grafana/data/src/transformations/transformers/order';

interface OrganizeFieldsTransformerEditorProps extends TransformerUIProps<OrganizeFieldsTransformerOptions> {}

const OrganizeFieldsTransformerEditor: React.FC<OrganizeFieldsTransformerEditorProps> = props => {
  const { options, input, onChange } = props;
  const { indexByName, excludeByName, renameByName } = options;

  const fieldNames = useMemo(() => getAllFieldNamesFromDataFrames(input), [input]);
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

  // Show warning that we only apply the first frame
  if (input.length > 1) {
    return <div>Organize fields only works with a single frame. Consider applying a join transformation first.</div>;
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="sortable-fields-transformer" direction="vertical">
        {provided => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {orderedFieldNames.map((fieldName, index) => {
              return (
                <DraggableFieldName
                  fieldName={fieldName}
                  renamedFieldName={renameByName[fieldName]}
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
  );
};

OrganizeFieldsTransformerEditor.displayName = 'OrganizeFieldsTransformerEditor';

interface DraggableFieldProps {
  fieldName: string;
  renamedFieldName?: string;
  index: number;
  visible: boolean;
  onToggleVisibility: (fieldName: string, isVisible: boolean) => void;
  onRenameField: (from: string, to: string) => void;
}

const DraggableFieldName: React.FC<DraggableFieldProps> = ({
  fieldName,
  renamedFieldName,
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
          className="gf-form-inline"
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--justify-left width-30">
              <Icon name="draggabledots" title="Drag and drop to reorder" size="lg" className={styles.draggable} />
              <IconButton
                className={styles.toggle}
                size="md"
                name={visible ? 'eye' : 'eye-slash'}
                surface="header"
                onClick={() => onToggleVisibility(fieldName, visible)}
              />
              <span className={styles.name} title={fieldName}>
                {fieldName}
              </span>
            </div>
            <Input
              className="flex-grow-1"
              defaultValue={renamedFieldName || ''}
              placeholder={`Rename ${fieldName}`}
              onBlur={event => onRenameField(fieldName, event.currentTarget.value)}
            />
          </div>
        </div>
      )}
    </Draggable>
  );
};

DraggableFieldName.displayName = 'DraggableFieldName';

const getFieldNameStyles = stylesFactory((theme: GrafanaTheme) => ({
  toggle: css`
    margin: 0 8px;
    color: ${theme.colors.textWeak};
  `,
  draggable: css`
    opacity: 0.4;
    &:hover {
      color: ${theme.colors.textStrong};
    }
  `,
  name: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

export const getAllFieldNamesFromDataFrames = (input: DataFrame[]): string[] => {
  if (!Array.isArray(input)) {
    return [] as string[];
  }

  return Object.keys(
    input.reduce((names, frame) => {
      if (!frame || !Array.isArray(frame.fields)) {
        return names;
      }

      return frame.fields.reduce((names, field) => {
        const t = getFieldDisplayName(field, frame, input);
        names[t] = true;
        return names;
      }, names);
    }, {} as Record<string, boolean>)
  );
};

export const organizeFieldsTransformRegistryItem: TransformerRegistyItem<OrganizeFieldsTransformerOptions> = {
  id: DataTransformerID.organize,
  editor: OrganizeFieldsTransformerEditor,
  transformation: standardTransformers.organizeFieldsTransformer,
  name: 'Organize fields',
  description:
    "Allows the user to re-order, hide, or rename fields / columns. Useful when data source doesn't allow overrides for visualizing data.",
};
