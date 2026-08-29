import { css } from '@emotion/css';
import { type DropResult } from '@hello-pangea/dnd';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2, MappingType, type SelectableValue, type ValueMapping } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useStyles2, Modal, ValuePicker, Button } from '@grafana/ui';
import { useDragAndDrop } from 'app/core/components/DragAndDrop/useDragAndDrop';

import { ValueMappingEditRow, type ValueMappingEditRowModel } from './ValueMappingEditRow';
import { buildEditRowModels, createRow, duplicateRow, editModelToSaveModel } from './editRowModels';

export interface Props {
  value: ValueMapping[];
  onChange: (valueMappings: ValueMapping[]) => void;
  onClose: () => void;
  showIconPicker?: boolean;
}

export function ValueMappingsEditorModal({ value, onChange, onClose, showIconPicker }: Props) {
  const { DragDropContext, Droppable } = useDragAndDrop();
  const styles = useStyles2(getStyles);
  const [rows, updateRows] = useState<ValueMappingEditRowModel[]>([]);

  useEffect(() => {
    updateRows(buildEditRowModels(value));
  }, [value]);

  const onDragEnd = (result: DropResult) => {
    if (!value || !result.destination) {
      return;
    }

    const copy = [...rows];
    const element = copy[result.source.index];
    copy.splice(result.source.index, 1);
    copy.splice(result.destination.index, 0, element);
    updateRows(copy);
  };

  const onChangeMapping = (index: number, row: ValueMappingEditRowModel) => {
    const newList = [...rows];
    newList.splice(index, 1, row);
    updateRows(newList);
  };

  const onRemoveRow = (index: number) => {
    const newList = [...rows];
    newList.splice(index, 1);
    updateRows(newList);
  };

  const mappingTypes: Array<SelectableValue<MappingType>> = [
    {
      label: t('dimensions.value-mappings-editor-modal.mapping-types.label.value', 'Value'),
      value: MappingType.ValueToText,
      description: t(
        'dimensions.value-mappings-editor-modal.mapping-types.description.match-a-specific-text-value',
        'Match a specific text value'
      ),
    },
    {
      label: t('dimensions.value-mappings-editor-modal.mapping-types.label.range', 'Range'),
      value: MappingType.RangeToText,
      description: t(
        'dimensions.value-mappings-editor-modal.mapping-types.description.match-a-numerical-range-of-values',
        'Match a numerical range of values'
      ),
    },
    {
      label: t('dimensions.value-mappings-editor-modal.mapping-types.label.regex', 'Regex'),
      value: MappingType.RegexToText,
      description: t(
        'dimensions.value-mappings-editor-modal.mapping-types.description.match-a-regular-expression-with-replacement',
        'Match a regular expression with replacement'
      ),
    },
    {
      label: t('dimensions.value-mappings-editor-modal.mapping-types.label.special', 'Special'),
      value: MappingType.SpecialValue,
      description: t(
        'dimensions.value-mappings-editor-modal.mapping-types.description.match-boolean-empty-values',
        'Match on null, NaN, boolean and empty values'
      ),
    },
  ];

  const onAddValueMapping = (value: SelectableValue<MappingType>) => {
    updateRows([...rows, createRow({ type: value.value!, result: {}, isNew: true })]);
  };

  const onDuplicateMapping = (index: number) => {
    const sourceRow = duplicateRow(rows[index]);
    const copy = [...rows];
    copy.splice(index, 0, { ...sourceRow });

    for (let i = index; i < rows.length; i++) {
      copy[i].result.index = i;
    }

    updateRows(copy);
  };

  const onUpdate = () => {
    onChange(editModelToSaveModel(rows));
    onClose();
  };

  // Start with an empty row
  useEffect(() => {
    if (!value?.length) {
      onAddValueMapping({ value: MappingType.ValueToText });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.editTable}>
          <thead>
            <tr>
              <th style={{ width: '1%' }}></th>
              <th style={{ width: '40%', textAlign: 'left' }} colSpan={2}>
                <Trans i18nKey="dimensions.value-mappings-editor-modal.condition">Condition</Trans>
              </th>
              <th style={{ textAlign: 'left' }}>
                <Trans i18nKey="dimensions.value-mappings-editor-modal.display-text">Display text</Trans>
              </th>
              <th style={{ width: '10%' }}>
                <Trans i18nKey="dimensions.value-mappings-editor-modal.color">Color</Trans>
              </th>
              {showIconPicker && (
                <th style={{ width: '10%' }}>
                  <Trans i18nKey="dimensions.value-mappings-editor-modal.icon">Icon</Trans>
                </th>
              )}
              <th style={{ width: '1%' }}></th>
            </tr>
          </thead>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="sortable-field-mappings" direction="vertical">
              {(provided) => (
                <tbody ref={provided.innerRef} {...provided.droppableProps}>
                  {rows.map((row, index) => (
                    <ValueMappingEditRow
                      key={row.id}
                      mapping={row}
                      index={index}
                      onChange={onChangeMapping}
                      onRemove={onRemoveRow}
                      onDuplicate={onDuplicateMapping}
                      showIconPicker={showIconPicker}
                    />
                  ))}
                  {provided.placeholder}
                </tbody>
              )}
            </Droppable>
          </DragDropContext>
        </table>
      </div>

      <Modal.ButtonRow
        leftItems={
          <ValuePicker
            label={t('dimensions.value-mappings-editor-modal.label-add-a-new-mapping', 'Add a new mapping')}
            variant="secondary"
            size="md"
            icon="plus"
            menuPlacement="auto"
            minWidth={40}
            options={mappingTypes}
            onChange={onAddValueMapping}
          />
        }
      >
        <Button variant="secondary" fill="outline" onClick={onClose}>
          <Trans i18nKey="dimensions.value-mappings-editor-modal.cancel">Cancel</Trans>
        </Button>
        <Button variant="primary" onClick={onUpdate}>
          <Trans i18nKey="dimensions.value-mappings-editor-modal.update">Update</Trans>
        </Button>
      </Modal.ButtonRow>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tableWrap: css({
    minHeight: '40px',
  }),

  editTable: css({
    width: '100%',
    marginBottom: theme.spacing(2),

    'thead th': {
      textAlign: 'center',
    },

    'tbody tr:hover': {
      background: theme.colors.action.hover,
    },

    ' th, td': {
      padding: theme.spacing(1),
    },
  }),
});
