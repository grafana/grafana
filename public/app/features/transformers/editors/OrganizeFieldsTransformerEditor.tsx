import { css } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';

import {
  DataTransformerID,
  GrafanaTheme2,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { createOrderFieldsComparer } from '@grafana/data/src/transformations/transformers/order';
import { OrganizeFieldsTransformerOptions } from '@grafana/data/src/transformations/transformers/organize';
import { Input, IconButton, Icon, FieldValidationMessage, useStyles2 } from '@grafana/ui';

import { useAllFieldNamesFromDataFrames } from '../utils';

interface OrganizeFieldsTransformerEditorProps extends TransformerUIProps<OrganizeFieldsTransformerOptions> {}

const OrganizeFieldsTransformerEditor: React.FC<OrganizeFieldsTransformerEditorProps> = (props) => {
  const { options, input, onChange } = props;
  const { indexByName, excludeByName, renameByName } = options;

  const fieldNames = useAllFieldNamesFromDataFrames(input);
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
    [onChange, options, excludeByName]
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
    [onChange, options]
  );

  // Show warning that we only apply the first frame
  if (input.length > 1) {
    return (
      <FieldValidationMessage>
        Organize fields only works with a single frame. Consider applying a join transformation first.
      </FieldValidationMessage>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="sortable-fields-transformer" direction="vertical">
        {(provided) => (
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

const DraggableFieldName = ({
  fieldName,
  renamedFieldName,
  index,
  visible,
  onToggleVisibility,
  onRenameField,
}: DraggableFieldProps) => {
  const styles = useStyles2(getFieldNameStyles);

  return (
    <Draggable draggableId={fieldName} index={index}>
      {(provided) => (
        <div className="gf-form-inline" ref={provided.innerRef} {...provided.draggableProps}>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--justify-left width-30">
              <Icon
                name="draggabledots"
                title="Drag and drop to reorder"
                size="lg"
                className={styles.draggable}
                {...provided.dragHandleProps}
              />
              <IconButton
                className={styles.toggle}
                size="md"
                name={visible ? 'eye' : 'eye-slash'}
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
              onBlur={(event) => onRenameField(fieldName, event.currentTarget.value)}
            />
          </div>
        </div>
      )}
    </Draggable>
  );
};

DraggableFieldName.displayName = 'DraggableFieldName';

const getFieldNameStyles = (theme: GrafanaTheme2) => ({
  toggle: css`
    margin: 0 8px;
    color: ${theme.colors.text.secondary};
  `,
  draggable: css`
    opacity: 0.4;
    &:hover {
      color: ${theme.colors.text.maxContrast};
    }
  `,
  name: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
  `,
});

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

export const organizeFieldsTransformRegistryItem: TransformerRegistryItem<OrganizeFieldsTransformerOptions> = {
  id: DataTransformerID.organize,
  editor: OrganizeFieldsTransformerEditor,
  transformation: standardTransformers.organizeFieldsTransformer,
  name: 'Organize fields',
  description:
    "Allows the user to re-order, hide, or rename fields / columns. Useful when data source doesn't allow overrides for visualizing data.",
};
