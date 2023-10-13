import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import React, { ChangeEvent, useCallback, useState } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';

import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  FieldType,
  SelectableValue,
  StandardEditorsRegistryItem,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  GrafanaTheme2,
  EnumFieldConfig,
} from '@grafana/data';
import {
  ConvertFieldTypeOptions,
  ConvertFieldTypeTransformerOptions,
} from '@grafana/data/src/transformations/transformers/convertFieldType';
import {
  Button,
  HorizontalGroup,
  Icon,
  IconButton,
  InlineField,
  InlineFieldRow,
  Input,
  Select,
  useStyles2,
  VerticalGroup,
} from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { allFieldTypeIconOptions } from '@grafana/ui/src/components/MatchersUI/FieldTypeMatcherEditor';
import { hasAlphaPanels } from 'app/core/config';
import { findField } from 'app/features/dimensions';

const fieldNamePickerSettings = {
  settings: { width: 24, isClearable: false },
} as StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings>;

export const ConvertFieldTypeTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<ConvertFieldTypeTransformerOptions>) => {
  const styles = useStyles2(getStyles);

  const allTypes = allFieldTypeIconOptions.filter((v) => v.value !== FieldType.trace);

  const onSelectField = useCallback(
    (idx: number) => (value: string | undefined) => {
      const conversions = options.conversions;
      conversions[idx] = { ...conversions[idx], targetField: value ?? '', dateFormat: undefined };
      onChange({
        ...options,
        conversions: conversions,
      });
    },
    [onChange, options]
  );

  const onSelectDestinationType = useCallback(
    (idx: number) => (value: SelectableValue<FieldType>) => {
      const conversions = options.conversions;
      conversions[idx] = { ...conversions[idx], destinationType: value.value };
      onChange({
        ...options,
        conversions: conversions,
      });
    },
    [onChange, options]
  );

  const onInputFormat = useCallback(
    (idx: number) => (e: ChangeEvent<HTMLInputElement>) => {
      const conversions = options.conversions;
      conversions[idx] = { ...conversions[idx], dateFormat: e.currentTarget.value };
      onChange({
        ...options,
        conversions: conversions,
      });
    },
    [onChange, options]
  );

  const onAddConvertFieldType = useCallback(() => {
    onChange({
      ...options,
      conversions: [
        ...options.conversions,
        { targetField: undefined, destinationType: undefined, dateFormat: undefined },
      ],
    });
  }, [onChange, options]);

  const onRemoveConvertFieldType = useCallback(
    (idx: number) => {
      const removed = options.conversions;
      removed.splice(idx, 1);
      onChange({
        ...options,
        conversions: removed,
      });
    },
    [onChange, options]
  );

  const [enumRows, updateEnumRows] = useState<string[]>([]);

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
    const targetField = input[0]?.fields?.find((field) => field.name === options.conversions[0].targetField);

    // create set of values for enum without any duplicate values (from targetField.values)
    // TODO: this shouldn't be hardcoded and should only run on first time / via a button (to initialize / reset?)
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
    updateEnumRows([...enumRows, 'value']);
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

  const applyEnumConfig = (index: number) => {
    // Reverse the order of the enum values to match the order of the enum values in the table
    const textValues = enumRows.map((value) => value).reverse();

    const conversions = options.conversions;
    const enumConfig: EnumFieldConfig = { text: textValues };
    conversions[index] = { ...conversions[index], enumConfig };
    onChange({
      ...options,
      conversions: conversions,
    });
  };

  return (
    <>
      {options.conversions.map((c: ConvertFieldTypeOptions, idx: number) => {
        return (
          <div key={`${c.targetField}-${idx}`}>
            <InlineFieldRow>
              <InlineField label={'Field'}>
                <FieldNamePicker
                  context={{ data: input }}
                  value={c.targetField ?? ''}
                  onChange={onSelectField(idx)}
                  item={fieldNamePickerSettings}
                />
              </InlineField>
              <InlineField label={'as'}>
                <Select
                  options={allTypes}
                  value={c.destinationType}
                  placeholder={'Type'}
                  onChange={onSelectDestinationType(idx)}
                  width={18}
                />
              </InlineField>
              {c.destinationType === FieldType.time && (
                <InlineField
                  label="Input format"
                  tooltip="Specify the format of the input field so Grafana can parse the date string correctly."
                >
                  <Input
                    value={c.dateFormat}
                    placeholder={'e.g. YYYY-MM-DD'}
                    onChange={onInputFormat(idx)}
                    width={24}
                  />
                </InlineField>
              )}
              {c.destinationType === FieldType.string &&
                (c.dateFormat || findField(input?.[0], c.targetField)?.type === FieldType.time) && (
                  <InlineField label="Date format" tooltip="Specify the output format.">
                    <Input
                      value={c.dateFormat}
                      placeholder={'e.g. YYYY-MM-DD'}
                      onChange={onInputFormat(idx)}
                      width={24}
                    />
                  </InlineField>
                )}
              <Button
                size="md"
                icon="trash-alt"
                variant="secondary"
                onClick={() => onRemoveConvertFieldType(idx)}
                aria-label={'Remove convert field type transformer'}
              />
            </InlineFieldRow>
            {c.destinationType === FieldType.enum && hasAlphaPanels && (
              <InlineFieldRow>
                <HorizontalGroup>
                  <Button size="sm" icon="plus" onClick={() => generateEnumValues()} className={styles.button}>
                    Generate enum values from data
                  </Button>
                  <Button size="sm" icon="plus" onClick={() => onAddEnumRow()} className={styles.button}>
                    Add enum value
                  </Button>
                  <Button size="sm" icon="save" onClick={() => applyEnumConfig(idx)} className={styles.button}>
                    Apply
                  </Button>
                </HorizontalGroup>

                {/* TODO: break this out into separate component?  */}
                <VerticalGroup>
                  <table className={styles.compactTable}>
                    <DragDropContext onDragEnd={onDragEnd}>
                      <Droppable droppableId="sortable-enum-config-mappings" direction="vertical">
                        {(provided) => (
                          <tbody ref={provided.innerRef} {...provided.droppableProps}>
                            {enumRows.map((value: string, index: number) => (
                              <Draggable key={value} draggableId={value} index={index}>
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
                                      <td
                                        onClick={() => setEditRow(index, value)}
                                        className={styles.clickableTableCell}
                                      >
                                        {value}
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
            )}
          </div>
        );
      })}
      <Button
        size="sm"
        icon="plus"
        onClick={onAddConvertFieldType}
        variant="secondary"
        aria-label={'Add a convert field type transformer'}
      >
        {'Convert field type'}
      </Button>
    </>
  );
};

export const convertFieldTypeTransformRegistryItem: TransformerRegistryItem<ConvertFieldTypeTransformerOptions> = {
  id: DataTransformerID.convertFieldType,
  editor: ConvertFieldTypeTransformerEditor,
  transformation: standardTransformers.convertFieldTypeTransformer,
  name: standardTransformers.convertFieldTypeTransformer.name,
  description: standardTransformers.convertFieldTypeTransformer.description,
  categories: new Set([TransformerCategory.Reformat]),
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
