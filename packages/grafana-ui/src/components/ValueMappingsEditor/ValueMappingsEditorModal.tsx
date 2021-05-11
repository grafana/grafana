import React, { useEffect, useState } from 'react';
import { GrafanaTheme2, MappingType, SpecialValueMatch, ValueMapping } from '@grafana/data';
import { Button } from '../Button/Button';
import { Modal } from '../Modal/Modal';
import { useStyles2 } from '../../themes';
import { ValueMappingEditRow, ValueMappingEditRowModel } from './ValueMappingEditRow';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { HorizontalGroup } from '../Layout/Layout';
import { css } from '@emotion/css';

export interface Props {
  value: ValueMapping[];
  onChange: (valueMappings: ValueMapping[]) => void;
  onClose: () => void;
}

export function ValueMappingsEditorModal({ value, onChange, onClose }: Props) {
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

  const onAddValueMap = () => {
    updateRows([
      ...rows,
      {
        type: MappingType.ValueToText,
        isNew: true,
        result: {},
      },
    ]);
  };

  const onAddRangeMap = () => {
    updateRows([
      ...rows,
      {
        type: MappingType.RangeToText,
        isNew: true,
        result: {},
      },
    ]);
  };

  const onAddSpecialValueMap = () => {
    updateRows([
      ...rows,
      {
        type: MappingType.SpecialValue,
        specialMatch: SpecialValueMatch.Null,
        result: {},
      },
    ]);
  };

  const onUpdate = () => {
    onChange(editModelToSaveModel(rows));
    onClose();
  };

  return (
    <>
      <table className={styles.editTable}>
        <thead>
          <tr>
            <th style={{ width: '1%' }}></th>
            <th style={{ width: '1%' }}>Type</th>
            <th style={{ width: '40%' }}>Match</th>
            <th>Display text</th>
            <th>Color</th>
            <th style={{ width: '1%' }}></th>
          </tr>
        </thead>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="sortable-field-mappings" direction="vertical">
            {(provided) => (
              <tbody ref={provided.innerRef} {...provided.droppableProps}>
                {rows.map((row, index) => (
                  <ValueMappingEditRow
                    key={index.toString()}
                    mapping={row}
                    index={index}
                    onChange={onChangeMapping}
                    onRemove={onRemoveRow}
                  />
                ))}
                {provided.placeholder}
              </tbody>
            )}
          </Droppable>
        </DragDropContext>
      </table>
      <HorizontalGroup>
        <Button variant="secondary" icon="plus" onClick={onAddValueMap} data-testid="add value map">
          Value map
        </Button>
        <Button variant="secondary" icon="plus" onClick={onAddRangeMap} data-testid="add range map">
          Range map
        </Button>
        <Button variant="secondary" icon="plus" onClick={onAddSpecialValueMap} data-testid="add special map">
          Special value map
        </Button>
      </HorizontalGroup>
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onUpdate}>
          Update
        </Button>
      </Modal.ButtonRow>
    </>
  );
}

export const getStyles = (theme: GrafanaTheme2) => ({
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

export function editModelToSaveModel(rows: ValueMappingEditRowModel[]) {
  const mappings: ValueMapping[] = [];
  const valueMaps: ValueMapping = {
    type: MappingType.ValueToText,
    options: {},
  };

  rows.forEach((item, index) => {
    const result = {
      ...item.result,
      index,
    };

    switch (item.type) {
      case MappingType.ValueToText:
        if (item.key != null) {
          valueMaps.options[item.key] = result;
        }
        break;
      case MappingType.RangeToText:
        if (item.from != null && item.to != null) {
          mappings.push({
            type: item.type,
            options: {
              from: item.from,
              to: item.to,
              result,
            },
          });
        }
        break;
      case MappingType.SpecialValue:
        mappings.push({
          type: item.type,
          options: {
            match: item.specialMatch!,
            result,
          },
        });
    }
  });

  if (Object.keys(valueMaps.options).length > 0) {
    mappings.unshift(valueMaps);
  }
  return mappings;
}

export function buildEditRowModels(value: ValueMapping[]) {
  const editRows: ValueMappingEditRowModel[] = [];

  for (const mapping of value) {
    switch (mapping.type) {
      case MappingType.ValueToText:
        for (const key of Object.keys(mapping.options)) {
          editRows.push({
            type: mapping.type,
            result: mapping.options[key],
            key,
          });
        }
        break;
      case MappingType.RangeToText:
        editRows.push({
          type: mapping.type,
          result: mapping.options.result,
          from: mapping.options.from ?? 0,
          to: mapping.options.to ?? 0,
        });
        break;
      case MappingType.SpecialValue:
        editRows.push({
          type: mapping.type,
          result: mapping.options.result,
          specialMatch: mapping.options.match ?? SpecialValueMatch.Null,
        });
    }
  }

  // Sort by index
  editRows.sort((a, b) => {
    return (a.result.index ?? 0) > (b.result.index ?? 0) ? 1 : -1;
  });

  return editRows;
}
