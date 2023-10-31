import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';

import { DataFrame, EnumFieldConfig, GrafanaTheme2 } from '@grafana/data';
import { ConvertFieldTypeTransformerOptions } from '@grafana/data/src/transformations/transformers/convertFieldType';
import {
  Button,
  HorizontalGroup,
  Icon,
  IconButton,
  InlineFieldRow,
  Input,
  useStyles2,
  VerticalGroup,
} from '@grafana/ui';

type EnumMappingEditorProps = {
  input: DataFrame[];
  options: ConvertFieldTypeTransformerOptions;
  convertFieldTransformIndex: number;
  onChange: (options: ConvertFieldTypeTransformerOptions) => void;
};

export const EnumMappingEditor = ({ input, options, convertFieldTransformIndex, onChange }: EnumMappingEditorProps) => {
  const styles = useStyles2(getStyles);

  const [enumRows, updateEnumRows] = useState<string[]>(
    options.conversions[convertFieldTransformIndex].enumConfig?.text ?? []
  );

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const copy = [...enumRows];
    const element = copy[result.source.index];
    copy.splice(result.source.index, 1);
    copy.splice(result.destination.index, 0, element);
    updateEnumRows(copy);
  };

  const generateEnumValues = () => {
    // Loop through all fields in provided data frames to find the target field
    const targetField = input
      .flatMap((inputItem) => inputItem?.fields ?? [])
      .find((field) => field.name === options.conversions[convertFieldTransformIndex].targetField);

    if (!targetField) {
      return;
    }

    // create set of values for enum without any duplicate values (from targetField.values)
    // maybe this should run automatically on first render?
    const enumValues = new Set(targetField?.values);

    if (enumRows.length > 0 && !isEqual(enumRows, Array.from(enumValues))) {
      const confirmed = window.confirm(
        'This action will overwrite the existing configuration. Are you sure you want to continue?'
      );
      if (!confirmed) {
        return;
      }
    }

    updateEnumRows([...enumValues]);
  };

  const onChangeEnumMapping = (index: number, enumRow: string) => {
    const newList = [...enumRows];
    newList.splice(index, 1, enumRow);
    updateEnumRows(newList);
  };

  const onRemoveEnumRow = (index: number) => {
    const newList = [...enumRows];
    newList.splice(index, 1);
    updateEnumRows(newList);
  };

  const onAddEnumRow = () => {
    updateEnumRows([...enumRows, '']);
  };

  const onChangeEnumValue = (index: number, value: string) => {
    onChangeEnumMapping(index, value);
  };

  // This current approach leads to sticky input (not dismissed when clicking outside input, and only through tabbing)
  // This can be addressed via adding a outside click handler and keeping track of inputRefs of each row
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const setEditRow = (index: number, value: string) => {
    setEditingIndex(index);
    setEditingValue(value);
  };

  useEffect(() => {
    const applyEnumConfig = () => {
      // Reverse the order of the enum values to match the order of the enum values in the table
      const textValues = enumRows.map((value) => value);

      const conversions = options.conversions;
      const enumConfig: EnumFieldConfig = { text: textValues };
      conversions[convertFieldTransformIndex] = { ...conversions[convertFieldTransformIndex], enumConfig };
      onChange({
        ...options,
        conversions: conversions,
      });
    };

    applyEnumConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convertFieldTransformIndex, enumRows]);

  return (
    <InlineFieldRow>
      <HorizontalGroup>
        <Button size="sm" icon="plus" onClick={() => generateEnumValues()} className={styles.button}>
          Generate enum values from data
        </Button>
        <Button size="sm" icon="plus" onClick={() => onAddEnumRow()} className={styles.button}>
          Add enum value
        </Button>
      </HorizontalGroup>

      <VerticalGroup>
        <table className={styles.compactTable}>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="sortable-enum-config-mappings" direction="vertical">
              {(provided) => (
                <tbody ref={provided.innerRef} {...provided.droppableProps}>
                  {enumRows.map((value: string, index: number) => (
                    <Draggable
                      key={`${convertFieldTransformIndex}/${value}`}
                      draggableId={`${convertFieldTransformIndex}/${value}`}
                      index={index}
                    >
                      {(provided) => (
                        <tr key={index} ref={provided.innerRef} {...provided.draggableProps}>
                          <td>
                            <div className={styles.dragHandle} {...provided.dragHandleProps}>
                              <Icon name="draggabledots" size="lg" />
                            </div>
                          </td>
                          {editingIndex === index ? (
                            <td>
                              <Input
                                type="text"
                                value={editingValue}
                                onChange={(event) => setEditingValue(event.currentTarget.value)}
                                onBlur={() => {
                                  setEditingIndex(null);
                                  onChangeEnumValue(index, editingValue);
                                }}
                              />
                            </td>
                          ) : (
                            <td onClick={() => setEditRow(index, value)} className={styles.clickableTableCell}>
                              {value && value !== '' ? value : 'Click to edit'}
                            </td>
                          )}
                          <td className={styles.textAlignCenter}>
                            <HorizontalGroup spacing="sm">
                              <IconButton
                                name="trash-alt"
                                onClick={() => onRemoveEnumRow(index)}
                                data-testid="remove-enum-row"
                                aria-label="Delete enum row"
                                tooltip="Delete"
                              />
                            </HorizontalGroup>
                          </td>
                        </tr>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </tbody>
              )}
            </Droppable>
          </DragDropContext>
        </table>
      </VerticalGroup>
    </InlineFieldRow>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  compactTable: css({
    'tbody td': {
      padding: theme.spacing(0.5),
    },
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
  }),
  dragHandle: css({
    cursor: 'grab',
    // create focus ring around the whole row when the drag handle is tab-focused
    // needs position: relative on the drag row to work correctly
    '&:focus-visible&:after': {
      bottom: 0,
      content: '""',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '-2px',
    },
  }),
  button: css({
    marginTop: theme.spacing(1),
  }),
  textAlignCenter: css({
    textAlign: 'center',
  }),
  clickableTableCell: css({
    cursor: 'pointer',
  }),
});
