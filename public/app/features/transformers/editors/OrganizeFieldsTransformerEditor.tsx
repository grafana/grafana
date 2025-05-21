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
  AutoSortOption,
  Order,
  FieldOrdering,
  OrganizeFieldsTransformerOptions,
} from '@grafana/data/internal';
import { Trans, useTranslate } from '@grafana/i18n';
import { t } from '@grafana/i18n/internal';
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

import { getTransformationContent } from '../docs/getTransformationContent';
import { getDistinctLabels, useAllFieldNamesFromDataFrames } from '../utils';

interface OrganizeFieldsTransformerEditorProps extends TransformerUIProps<OrganizeFieldsTransformerOptions> {}

type AutoSortOptions = Array<{ order: Order; index: number; labelName?: string }>;

// draggable component needs an identifier, this is something that shouldn't be a label key
const FIELD_NAME_DRAGGABLE_ID = '!{{fieldName}}';

const OrganizeFieldsTransformerEditor = ({ options, input, onChange }: OrganizeFieldsTransformerEditorProps) => {
  const { indexByName, excludeByName, renameByName, includeByName } = options;

  const fieldNames = useAllFieldNamesFromDataFrames(input);
  const orderedFieldNames = useMemo(() => orderFieldNamesByIndex(fieldNames, indexByName), [fieldNames, indexByName]);
  const distinctLabels = Array.from(getDistinctLabels(input));

  // find labels that exist for the data but do not have an existing sort and append them to the list of possible options
  const unSortedLabels: AutoSortOption[] = differenceWith(
    distinctLabels,
    options.autoSortOptions ?? [],
    (distLabl, sortLabel) => distLabl === sortLabel.labelName
  ).map((label, i) => ({ labelName: label, order: Order.Off, index: (options.autoSortOptions?.length ?? 0) + i }));

  const allAutoSortOptions = useMemo(
    (): AutoSortOptions => [...(options.autoSortOptions ?? []), ...unSortedLabels].sort((a, b) => a.index - b.index),
    [options.autoSortOptions, unSortedLabels]
  );

  // if the field name sort was not already set, add it to the end
  if ((options.autoSortOptions ?? []).findIndex((aso) => aso.labelName === undefined) === -1) {
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

  // when any option in auto mode is changed, even if the sort is off, we save what we have at that time so the indexes are preserved and fields don't jump around
  const onChangeSort = useCallback(
    (sortOptionString: string, sortOrder: Order) => {
      const allOptions = [...allAutoSortOptions];
      const changedIdx = allOptions.findIndex(
        (label) =>
          (sortOptionString === FIELD_NAME_DRAGGABLE_ID && label.labelName === undefined) ||
          label.labelName === sortOptionString
      );
      allOptions[changedIdx].order = sortOrder;
      onChange({ ...options, autoSortOptions: allOptions });
    },
    [allAutoSortOptions, onChange, options]
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

      let delta = startIndex - endIndex;
      const isForward = delta < 0;
      delta = Math.abs(delta);

      const allOptions = [...allAutoSortOptions];
      const changedSort = allOptions.splice(startIndex, 1)[0];
      changedSort.index = endIndex;

      for (let i = 0; i < delta; i++) {
        const changeIndex = allOptions.findIndex((opt) => opt.index === (isForward ? startIndex + 1 : endIndex) + i);
        allOptions[changeIndex].index = allOptions[changeIndex].index + (isForward ? -1 : 1);
      }

      allOptions.push(changedSort);

      onChange({
        ...options,
        autoSortOptions: allOptions.sort((a, b) => a.index - b.index),
      });
    },
    [allAutoSortOptions, onChange, options]
  );

  // Show warning that we only apply the first frame
  if (input.length > 1) {
    return (
      <FieldValidationMessage>
        <Trans i18nKey="transformers.organize-fields-transformer-editor.first-frame-warning">
          Organize fields only works with a single frame. Consider applying a join transformation or filtering the input
          first.
        </Trans>
      </FieldValidationMessage>
    );
  }

  const styles = useStyles2(getDraggableStyles);

  return (
    <>
      <InlineFieldRow>
        <InlineField label={t('transformers.organize-fields-transformer-editor.field-order', 'Field Order')}>
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
                        key={label.labelName ?? FIELD_NAME_DRAGGABLE_ID}
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
  const { t } = useTranslate();
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
                tooltip={
                  visible
                    ? t('transformers.draggable-field-name.tooltip-disable', 'Disable')
                    : t('transformers.draggable-field-name.tooltip-enable', 'Enable')
                }
              />
              <Text truncate={true} element="p" variant="bodySmall" weight="bold">
                {fieldName}
              </Text>
            </Stack>
          </InlineLabel>
          <Input
            defaultValue={renamedFieldName || ''}
            placeholder={t('transformers.draggable-field-name.rename-placeholder', 'Rename {{fieldName}}', {
              fieldName,
            })}
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
  onChangeSort: (sortOptionString: string, order: Order) => void;
}

const DraggableLabel = ({ labelKeyName, index, order, isFieldName, onChangeSort }: DraggableLabelProps) => {
  const styles = useStyles2(getFieldNameStyles);

  return (
    <Draggable draggableId={isFieldName ? FIELD_NAME_DRAGGABLE_ID : `${labelKeyName}`} index={index}>
      {(provided) => (
        <Box marginBottom={0.5} display="flex" gap={0} ref={provided.innerRef} {...provided.draggableProps}>
          <InlineLabel width={60} as="div">
            <Stack gap={3} justifyContent="flex-start" alignItems="center" width="100%">
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
            onChange={(order) => {
              onChangeSort(isFieldName ? FIELD_NAME_DRAGGABLE_ID : labelKeyName, order);
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
