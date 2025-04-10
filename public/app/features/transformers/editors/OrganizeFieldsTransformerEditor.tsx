import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import {
  DataTransformerID,
  GrafanaTheme2,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { createOrderFieldsComparer, OrganizeFieldsTransformerOptions } from '@grafana/data/internal';
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
} from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { getTransformationContent } from '../docs/getTransformationContent';
import { useAllFieldNamesFromDataFrames } from '../utils';

interface OrganizeFieldsTransformerEditorProps extends TransformerUIProps<OrganizeFieldsTransformerOptions> {}

const OrganizeFieldsTransformerEditor = ({ options, input, onChange }: OrganizeFieldsTransformerEditorProps) => {
  const { indexByName, excludeByName, renameByName, includeByName } = options;

  const fieldNames = useAllFieldNamesFromDataFrames(input);
  const orderedFieldNames = useMemo(() => orderFieldNamesByIndex(fieldNames, indexByName), [fieldNames, indexByName]);
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
        <Trans i18nKey="transformers.organize-fields-transformer-editor.first-frame-warning">
          Organize fields only works with a single frame. Consider applying a join transformation or filtering the input
          first.
        </Trans>
      </FieldValidationMessage>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
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
        <Box marginBottom={0.5} display="flex" gap={0} ref={provided.innerRef} {...provided.draggableProps}>
          <InlineLabel width={60} as="div">
            <Stack gap={0} justifyContent="flex-start" alignItems="center" width="100%">
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
