import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useCallback, useId, useMemo } from 'react';

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
  Order,
  OrderByItem,
  OrderByMode,
  OrderByType,
  OrganizeFieldsTransformerOptions,
} from '@grafana/data/internal';
import { Trans, t } from '@grafana/i18n';
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

import { createFieldsOrdererAuto } from '../../../../../packages/grafana-data/src/transformations/transformers/order';
import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/organize.svg';
import lightImage from '../images/light/organize.svg';
import { getAllFieldNamesFromDataFrames, getDistinctLabels, useAllFieldNamesFromDataFrames } from '../utils';

interface OrganizeFieldsTransformerEditorProps extends TransformerUIProps<OrganizeFieldsTransformerOptions> {}

interface UIOrderByItem {
  type: OrderByType;
  name?: string;
  order: Order;
}

function move(arr: unknown[], from: number, to: number) {
  arr.splice(to, 0, arr.splice(from, 1)[0]);
}

const OrganizeFieldsTransformerEditor = ({ options, input, onChange }: OrganizeFieldsTransformerEditorProps) => {
  const { indexByName, excludeByName, renameByName, includeByName, orderBy, orderByMode } = options;

  const fieldNames = useAllFieldNamesFromDataFrames(input);
  const orderedFieldNames = useMemo(() => {
    if (input.length > 0 && orderByMode === OrderByMode.Auto) {
      const autoOrderer = createFieldsOrdererAuto(orderBy ?? []);

      return getAllFieldNamesFromDataFrames(
        [
          {
            ...input[0],
            fields: autoOrderer(input[0].fields),
          },
        ],
        false
      );
    }

    return orderFieldNamesByIndex(fieldNames, indexByName);
  }, [input, fieldNames, indexByName, orderByMode, orderBy]);

  const uiOrderByItems = useMemo(() => {
    const uiOrderByItems: UIOrderByItem[] = [];

    if (orderByMode === OrderByMode.Auto) {
      const foundLabels = getDistinctLabels(input);

      let byFieldNameAdded = false;

      // add Asc or Desc items
      orderBy?.forEach((item, index) => {
        let order = item.desc ? Order.Desc : Order.Asc;

        // by field name
        if (item.type === OrderByType.Name) {
          uiOrderByItems.push({
            type: OrderByType.Name,
            order,
          });

          byFieldNameAdded = true;
        }
        // by label
        else if (foundLabels.has(item.name!)) {
          uiOrderByItems.push({
            type: OrderByType.Label,
            name: item.name,
            order,
          });

          foundLabels.delete(item.name!);
        }
      });

      // add Off items
      if (!byFieldNameAdded) {
        uiOrderByItems.push({
          type: OrderByType.Name,
          order: Order.Off,
        });
      }

      foundLabels.forEach((name) => {
        uiOrderByItems.push({
          type: OrderByType.Label,
          name,
          order: Order.Off,
        });
      });
    }

    return uiOrderByItems;
  }, [input, orderByMode, orderBy]);

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

  const onChangeSort = useCallback(
    (item: UIOrderByItem, sortOrder: Order) => {
      item.order = sortOrder;

      const orderBy: OrderByItem[] = [];

      uiOrderByItems.forEach((item) => {
        if (item.order !== Order.Off) {
          orderBy.push({
            type: item.type,
            name: item.name,
            desc: item.order === Order.Desc,
          });
        }
      });

      onChange({ ...options, orderBy });
    },
    [options, uiOrderByItems, onChange]
  );

  const onDragEndLabels = useCallback(
    (result: DropResult) => {
      if (result.destination == null) {
        return;
      }

      const startIndex = result.source.index;
      const endIndex = result.destination.index;

      if (startIndex === endIndex) {
        return;
      }

      move(uiOrderByItems, startIndex, endIndex);

      const orderBy: OrderByItem[] = [];

      uiOrderByItems.forEach((item) => {
        if (item.order !== Order.Off) {
          orderBy.push({
            type: item.type,
            name: item.name,
            desc: item.order === Order.Desc,
          });
        }
      });

      onChange({ ...options, orderBy });
    },
    [options, onChange, uiOrderByItems]
  );

  const styles = useStyles2(getDraggableStyles);

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

  return (
    <>
      <InlineFieldRow className={styles.fieldOrderRadio}>
        <InlineField label={t('transformers.organize-fields-transformer-editor.field-order', 'Field order')}>
          <RadioButtonGroup
            options={[
              {
                label: t('transformers.organize-fields-transformer-editor.field-order-manual', 'Manual'),
                value: OrderByMode.Manual,
              },
              {
                label: t('transformers.organize-fields-transformer-editor.field-order-auto', 'Auto'),
                value: OrderByMode.Auto,
              },
            ]}
            value={options.orderByMode ?? OrderByMode.Manual}
            onChange={(v) => onChange({ ...options, orderByMode: v })}
          />
        </InlineField>
      </InlineFieldRow>
      <DragDropContext onDragEnd={onDragEndLabels}>
        {options.orderByMode === OrderByMode.Auto && (
          <Droppable droppableId="sortable-labels-transformer" direction="vertical">
            {(provided) => {
              return (
                <>
                  <div ref={provided.innerRef} className={styles.labelsDraggable} {...provided.droppableProps}>
                    {uiOrderByItems.map((item, idx) => (
                      <DraggableUIOrderByItem
                        item={item}
                        index={idx}
                        onChangeSort={onChangeSort}
                        key={`${item.name}-${item.type}`}
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
                    isDragDisabled={options.orderByMode === OrderByMode.Auto}
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
  fieldOrderRadio: css({
    marginBottom: theme.spacing(1),
  }),
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
              interpolation: { escapeValue: false },
            })}
            onBlur={(event) => onRenameField(fieldName, event.currentTarget.value)}
          />
        </Box>
      )}
    </Draggable>
  );
};

DraggableFieldName.displayName = 'DraggableFieldName';

interface DraggableUIOrderByItemProps {
  item: UIOrderByItem;
  index: number;
  onChangeSort: (item: UIOrderByItem, order: Order) => void;
}

const DraggableUIOrderByItem = ({ index, item, onChangeSort }: DraggableUIOrderByItemProps) => {
  const styles = useStyles2(getFieldNameStyles);
  const draggableId = useId();

  return (
    <Draggable draggableId={draggableId} index={index} isDragDisabled={item.order === Order.Off}>
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
                  className={cx(styles.draggable, { [styles.disabled]: item.order === Order.Off })}
                />
              </span>
              <Text truncate={true} element="p" variant="bodySmall" weight="bold">
                {item.type === OrderByType.Label ? `Label: ${item.name}` : `Field name`}
              </Text>
            </Stack>
          </InlineLabel>
          <RadioButtonGroup
            options={[
              { label: t('transformers.draggable-sort-order.off', 'Off'), value: Order.Off },
              { label: t('transformers.draggable-sort-order.asc', 'ASC'), value: Order.Asc },
              { label: t('transformers.draggable-sort-order.desc', 'DESC'), value: Order.Desc },
            ]}
            value={item.order}
            onChange={(order) => {
              onChangeSort(item, order);
            }}
          />
        </Box>
      )}
    </Draggable>
  );
};

DraggableUIOrderByItem.displayName = 'DraggableUIOrderByItem';

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
  disabled: css({
    color: theme.colors.text.disabled,
    pointerEvents: 'none',
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

export const getOrganizeFieldsTransformRegistryItem: () => TransformerRegistryItem<OrganizeFieldsTransformerOptions> =
  () => ({
    id: DataTransformerID.organize,
    editor: OrganizeFieldsTransformerEditor,
    transformation: standardTransformers.organizeFieldsTransformer,
    name: t('transformers.organize-fields-transformer-editor.name.organize-fields', 'Organize fields by name'),
    description: t(
      'transformers.organize-fields-transformer-editor.description.reorder-hide-or-rename-fields',
      'Re-order, hide, or rename fields.'
    ),
    categories: new Set([TransformerCategory.ReorderAndRename]),
    help: getTransformationContent(DataTransformerID.organize).helperDocs,
    imageDark: darkImage,
    imageLight: lightImage,
  });
