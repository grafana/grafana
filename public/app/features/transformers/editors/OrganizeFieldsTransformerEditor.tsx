import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { differenceWith } from 'lodash';
import { useCallback, useMemo } from 'react';

import {
  DataTransformerID,
  GrafanaTheme2,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import {
  createOrderFieldsComparer,
  LabelSort,
  Order,
  FieldOrdering,
  OrganizeFieldsTransformerOptions,
} from '@grafana/data/internal';
import {
  Input,
  IconButton,
  Icon,
  FieldValidationMessage,
  useStyles2,
  Stack,
  InlineLabel,
  Text,
  Box,
  InlineField,
  InlineFieldRow,
  RadioButtonGroup,
} from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { getTransformationContent } from '../docs/getTransformationContent';
import { getDistinctLabels, useAllFieldNamesFromDataFrames } from '../utils';

interface OrganizeFieldsTransformerEditorProps extends TransformerUIProps<OrganizeFieldsTransformerOptions> {}

const FIELD_NAME = 'fieldName';

const OrganizeFieldsTransformerEditor = ({ options, input, onChange }: OrganizeFieldsTransformerEditorProps) => {
  const { indexByName, excludeByName, renameByName, includeByName } = options;

  const fieldNames = useAllFieldNamesFromDataFrames(input);
  const orderedFieldNames = useMemo(() => orderFieldNamesByIndex(fieldNames, indexByName), [fieldNames, indexByName]);
  const distinctLabels = Array.from(getDistinctLabels(input));

  const sortedLabels = useMemo(
    (): Array<{ order: Order; index: number; labelName?: string }> => [...(options.labelSort ?? [])],
    [options.labelSort]
  );

  // if fieldNameSort is there, add it to the array so the unsorted labels will get the right index
  if (options.fieldNameSort) {
    sortedLabels.push({ ...options.fieldNameSort });
  }

  const unSortedLabels: LabelSort[] = differenceWith(
    distinctLabels,
    options.labelSort,
    (distLabl, sortLabel) => distLabl === sortLabel.labelName
  ).map((label, i) => ({ labelName: label, order: Order.Off, index: sortedLabels.length + i }));

  const allAutoSortOptions = useMemo(
    (): Array<{ order: Order; index: number; labelName?: string }> => [...sortedLabels, ...unSortedLabels],
    [sortedLabels, unSortedLabels]
  );

  if (!options.fieldNameSort) {
    allAutoSortOptions.push({
      index: allAutoSortOptions.length,
      order: Order.Off,
    });
  }

  const filterType = includeByName && Object.keys(includeByName).length > 0 ? 'include' : 'exclude';

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

  const onToggleVisibilityInclude = useCallback(
    (field: string, shouldInclude: boolean) => {
      const pendingState = {
        ...options,
        includeByName: {
          ...includeByName,
          [field]: !shouldInclude,
        },
      };
      onChange(pendingState);
    },
    [onChange, options, includeByName]
  );

  const onDragEndFields = useCallback(
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

  const onDragEndLabels = useCallback(
    (result: DropResult) => {
      if (!result || !result.destination) {
        return;
      }

      const startIndex = result.source.index;
      const endIndex = result.destination.index;

      if (startIndex === endIndex) {
        return;
      }

      const isFieldName = result.draggableId === FIELD_NAME;

      if (isFieldName) {
        onChange({
          ...options,
          fieldNameSort: { order: options.fieldNameSort?.order ?? Order.Off, index: endIndex },
        });
      } else {
        // const labelDetails = allAutoSortOptions.find((l) => l.labelName === result.draggableId);
        const newOptsLabels = options.labelSort ? [...options.labelSort] : [];
        const labelSortIndex = newOptsLabels.findIndex((l) => l.labelName === result.draggableId);

        if (labelSortIndex === -1) {
          newOptsLabels.push({ labelName: result.draggableId, order: Order.Off, index: endIndex });
        } else {
          newOptsLabels[labelSortIndex] = {
            labelName: newOptsLabels[labelSortIndex].labelName!,
            order: newOptsLabels[labelSortIndex].order!,
            index: endIndex,
          };
        }

        onChange({
          ...options,
          labelSort: newOptsLabels,
        });
      }
    },
    [onChange, options]
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

  const onChangeSort = useCallback(
    (isFieldName: boolean, labelName: string, sortOrder: Order) => {
      if (isFieldName) {
        const fieldNameOpt = allAutoSortOptions.find((opt) => opt.labelName === undefined);
        onChange({
          ...options,
          fieldNameSort: { index: options.fieldNameSort?.index ?? fieldNameOpt?.index, order: sortOrder },
        });
      } else {
        const optionsLabels = options.labelSort ?? [];
        const fieldOptionsIdx = optionsLabels.findIndex((label) => label.labelName === labelName);
        if (fieldOptionsIdx === -1) {
          //  not found in options, add
          const labelIndex = allAutoSortOptions.findIndex((label) => label.labelName === labelName);
          const newLabelSort: LabelSort = { labelName, index: labelIndex, order: sortOrder };
          onChange({ ...options, labelSort: [...optionsLabels, newLabelSort] });
        } else {
          let labelSort = optionsLabels[fieldOptionsIdx];
          const newLabelSortArr = optionsLabels.filter((v, i) => i !== fieldOptionsIdx);
          if (sortOrder !== Order.Off) {
            labelSort.order = sortOrder;
            newLabelSortArr.push(labelSort);
          }
          onChange({ ...options, labelSort: newLabelSortArr });
        }
      }
    },
    [allAutoSortOptions, onChange, options]
  );

  // Show warning that we only apply the first frame
  if (input.length > 1) {
    return (
      <FieldValidationMessage>
        Organize fields only works with a single frame. Consider applying a join transformation or filtering the input
        first.
      </FieldValidationMessage>
    );
  }

  const styles = useStyles2(getDraggableStyles);

  return (
    <>
      <InlineFieldRow>
        <InlineField label={'Field Order'}>
          <RadioButtonGroup
            options={[
              { label: 'Manual', value: FieldOrdering.Manual },
              { label: 'Auto', value: FieldOrdering.Auto },
            ]}
            value={options.fieldOrder ?? FieldOrdering.Manual}
            onChange={(v) => onChange({ ...options, fieldOrder: v })}
          />
        </InlineField>
      </InlineFieldRow>
      <DragDropContext onDragEnd={onDragEndLabels}>
        {options.fieldOrder === FieldOrdering.Auto && (
          <Droppable droppableId="sortable-labels-transformer" direction="vertical">
            {(provided) => {
              return (
                <>
                  <div ref={provided.innerRef} className={styles.labelsDraggable} {...provided.droppableProps}>
                    {allAutoSortOptions.map((label, idx) => (
                      <DraggableLabel
                        key={label.labelName ?? FIELD_NAME}
                        labelKeyName={label.labelName ?? 'Field Name'}
                        index={idx}
                        isFieldName={label.labelName === undefined}
                        onChangeSort={onChangeSort}
                        order={label.order}
                      />
                    ))}
                  </div>
                  {provided.placeholder}
                </>
              );
            }}
          </Droppable>
        )}
      </DragDropContext>

      <DragDropContext onDragEnd={onDragEndFields}>
        <Droppable droppableId="sortable-fields-transformer" direction="vertical">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {orderedFieldNames.map((fieldName, index) => {
                const isIncludeFilter = includeByName && fieldName in includeByName ? includeByName[fieldName] : false;
                const isVisible = filterType === 'include' ? isIncludeFilter : !excludeByName[fieldName];
                const onToggleFunction = filterType === 'include' ? onToggleVisibilityInclude : onToggleVisibility;

                return (
                  <DraggableFieldName
                    fieldName={fieldName}
                    renamedFieldName={renameByName[fieldName]}
                    index={index}
                    onToggleVisibility={onToggleFunction}
                    onRenameField={onRenameField}
                    visible={isVisible}
                    key={fieldName}
                    isDragDisabled={options.fieldOrder === FieldOrdering.Auto}
                  />
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </>
  );
};

const getDraggableStyles = (theme: GrafanaTheme2) => ({
  labelsDraggable: css({
    marginBottom: theme.spacing(3),
  }),
});

OrganizeFieldsTransformerEditor.displayName = 'OrganizeFieldsTransformerEditor';

interface DraggableFieldProps {
  fieldName: string;
  renamedFieldName?: string;
  index: number;
  visible: boolean;
  onToggleVisibility: (fieldName: string, isVisible: boolean) => void;
  onRenameField: (from: string, to: string) => void;
  isDragDisabled: boolean;
}

const DraggableFieldName = ({
  fieldName,
  renamedFieldName,
  index,
  visible,
  onToggleVisibility,
  onRenameField,
  isDragDisabled,
}: DraggableFieldProps) => {
  const styles = useStyles2(getFieldNameStyles);

  return (
    <Draggable draggableId={fieldName} index={index} isDragDisabled={isDragDisabled}>
      {(provided) => (
        <Box display="flex" gap={0} ref={provided.innerRef} {...provided.draggableProps}>
          <InlineLabel width={60} as="div">
            <Stack gap={0} justifyContent="flex-start" alignItems="center" width="100%">
              {!isDragDisabled && (
                <span {...provided.dragHandleProps}>
                  <Icon
                    name="draggabledots"
                    title={t(
                      'transformers.draggable-field-name.title-drag-and-drop-to-reorder',
                      'Drag and drop to reorder'
                    )}
                    size="lg"
                    className={styles.draggable}
                  />
                </span>
              )}
              <IconButton
                className={styles.toggle}
                size="md"
                name={visible ? 'eye' : 'eye-slash'}
                onClick={() => onToggleVisibility(fieldName, visible)}
                tooltip={visible ? 'Disable' : 'Enable'}
              />
              <Text truncate={true} element="p" variant="bodySmall" weight="bold">
                {fieldName}
              </Text>
            </Stack>
          </InlineLabel>
          <Input
            defaultValue={renamedFieldName || ''}
            placeholder={`Rename ${fieldName}`}
            onBlur={(event) => onRenameField(fieldName, event.currentTarget.value)}
          />
        </Box>
      )}
    </Draggable>
  );
};

DraggableFieldName.displayName = 'DraggableFieldName';

interface DraggableLabelProps {
  labelKeyName: string;
  index: number;
  order?: Order;
  isFieldName: boolean;
  onChangeSort: (isFieldName: boolean, labelName: string, order: Order) => void;
}

const DraggableLabel = ({ labelKeyName, index, order, isFieldName, onChangeSort }: DraggableLabelProps) => {
  const styles = useStyles2(getFieldNameStyles);

  return (
    <Draggable draggableId={isFieldName ? FIELD_NAME : `${labelKeyName}`} index={index}>
      {(provided) => (
        <Box marginBottom={0.5} display="flex" gap={0} ref={provided.innerRef} {...provided.draggableProps}>
          <InlineLabel width={60} as="div">
            <Stack gap={3} justifyContent="flex-start" alignItems="center" width="100%">
              <span {...provided.dragHandleProps}>
                <Icon name="draggabledots" title="Drag and drop to reorder" size="lg" className={styles.draggable} />
              </span>

              <Text truncate={true} element="p" variant="bodySmall" weight="bold">
                {!isFieldName && 'Label:'} {labelKeyName}
              </Text>
            </Stack>
          </InlineLabel>
          <RadioButtonGroup
            options={[
              { label: 'Off', value: Order.Off },
              { label: 'ASC', value: Order.Asc },
              { label: 'DESC', value: Order.Desc },
            ]}
            value={order ?? Order.Off}
            onChange={(v) => {
              onChangeSort(isFieldName, labelKeyName, v);
            }}
          />
        </Box>
      )}
    </Draggable>
  );
};

DraggableLabel.displayName = 'DraggableLabel';

const getFieldNameStyles = (theme: GrafanaTheme2) => ({
  toggle: css({
    margin: theme.spacing(0, 1),
    color: theme.colors.text.secondary,
  }),
  draggable: css({
    opacity: 0.4,
    '&:hover': {
      color: theme.colors.text.maxContrast,
    },
  }),
});

const reorderToIndex = (fieldNames: string[], startIndex: number, endIndex: number) => {
  const result = Array.from(fieldNames);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result.reduce<Record<string, number>>((nameByIndex, fieldName, index) => {
    nameByIndex[fieldName] = index;
    return nameByIndex;
  }, {});
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
  name: standardTransformers.organizeFieldsTransformer.name,
  description:
    "Allows the user to re-order, hide, or rename fields / columns. Useful when data source doesn't allow overrides for visualizing data.",
  categories: new Set([TransformerCategory.ReorderAndRename]),
  help: getTransformationContent(DataTransformerID.organize).helperDocs,
};
