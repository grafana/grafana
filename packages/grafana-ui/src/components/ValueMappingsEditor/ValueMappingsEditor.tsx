import React, { useCallback, useEffect, useState } from 'react';
import { GrafanaTheme2, MappingType, ValueMapping } from '@grafana/data';
import { Button } from '../Button/Button';
import { Modal } from '../Modal/Modal';
import { useStyles2 } from '../../themes';
import { css } from '@emotion/css';
import { ValueMappingEditRow, ValueMappingEditRowModel } from './ValueMappingEditRow';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

// import {
//   DragDropContext,
//   Draggable,
//   DraggableProvidedDragHandleProps,
//   Droppable,
//   DropResult,
// } from 'react-beautiful-dnd';
//import { css } from 'emotion';
//import { stylesFactory } from '../../themes';
// import { IconButton } from '../IconButton/IconButton';
// import { Input } from '../Input/Input';
// import { Button } from '../Button';
// import { ValueMapRow } from './ValueMappingRow';
// import { RangeMapRow } from './RangeMappingRow';
// import { VerticalGroup } from '../Layout/Layout';
// import { DraggableMappingRow } from './DraggableMappingRow';

export interface Props {
  value: ValueMapping[];
  onChange: (valueMappings: ValueMapping[]) => void;
}

// interface DraggableMappingProps {
//   mapping: ValueMapping;
//   index: number;
//   onChange: (index: number, mapping: ValueMapping) => void;
//   onRemove: (index: number) => void;
// }

// const DraggableMapping: React.FC<DraggableMappingProps> = ({ mapping, index, onChange, onRemove }) => {
//   const styles = useStyles(getStyles);

//   const displayInput = useMemo(
//     () => (
//       <Input
//         className={styles.displayInput}
//         defaultValue={mapping.text || ''}
//         onBlur={(event) => {
//           onChange(index, { ...mapping, text: event.currentTarget.value });
//         }}
//         prefix={'Display'}
//       />
//     ),
//     [onChange, mapping, index, styles]
//   );

//   const removeButton = useMemo(
//     () => (
//       <IconButton
//         size="sm"
//         name="times"
//         surface="dashboard"
//         onClick={() => onRemove(index)}
//         className={styles.removeButton}
//       />
//     ),
//     [onRemove, styles, index]
//   );

//   const renderMapping = useCallback(
//     (mappingRow: React.ReactNode, dragHandleProps: DraggableProvidedDragHandleProps, label: string) => (
//       <div className={styles.handleWrap}>
//         <DraggableMappingRow label={label} {...dragHandleProps} />

//         <VerticalGroup spacing={'xs'} width="100%">
//           {mappingRow}
//           {displayInput}
//         </VerticalGroup>
//       </div>
//     ),
//     [styles, displayInput]
//   );

//   return (
//     <Draggable draggableId={`mapping-${index}`} index={index}>
//       {(provided) => (
//         <div
//           className={cx('gf-form-inline', styles.row)}
//           ref={provided.innerRef}
//           {...provided.draggableProps}
//           tabIndex={0}
//         >
//           <div className={styles.rowWrap}>
//             {mapping.type === MappingType.ValueToText &&
//               renderMapping(
//                 <ValueMapRow mapping={(mapping as unknown) as ValueMap} index={index} onChange={onChange} />,
//                 provided.dragHandleProps!,
//                 'Value'
//               )}

//             {mapping.type === MappingType.RangeToText &&
//               renderMapping(
//                 <RangeMapRow mapping={(mapping as unknown) as RangeMap} index={index} onChange={onChange} />,
//                 provided.dragHandleProps!,
//                 'Range'
//               )}
//             {removeButton}
//           </div>
//         </div>
//       )}
//     </Draggable>
//   );
// };

export function ValueMappingsEditor({ value, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const onCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
  }, [setIsEditorOpen]);

  return (
    <>
      <Button variant="secondary" size="sm" fullWidth onClick={() => setIsEditorOpen(true)} icon="pen">
        Edit
      </Button>
      <Modal isOpen={isEditorOpen} title="Value mappings editor" onDismiss={onCloseEditor} className={styles.modal}>
        <ValueMappingsEditorModal value={value} onChange={onChange} onClose={onCloseEditor} />
      </Modal>
    </>
  );
}

interface ModalProps {
  value: ValueMapping[];
  onChange: (valueMappings: ValueMapping[]) => void;
  onClose: () => void;
}

function ValueMappingsEditorModal({ value, onChange, onClose }: ModalProps) {
  const styles = useStyles2(getStyles);
  const [rows, updateRows] = useState<ValueMappingEditRowModel[]>([]);

  const onUpdate = () => {
    onClose();
  };

  useEffect(() => {
    const editRows: ValueMappingEditRowModel[] = [];
    for (const mapping of value) {
      switch (mapping.type) {
        case MappingType.ValueToText:
          for (const key of Object.keys(mapping.map)) {
            editRows.push({
              type: mapping.type,
              result: mapping.map[key],
              key,
            });
          }
          break;
        case MappingType.RangeToText:
          editRows.push({
            type: mapping.type,
            result: mapping.result,
            from: mapping.from ?? 0,
            to: mapping.to ?? 0,
          });
      }
    }
    updateRows(editRows);
  }, [value]);

  const onDragEnd = (result: DropResult) => {};

  const onChangeMapping = useCallback((index: number, model: ValueMappingEditRowModel) => {}, []);

  return (
    <>
      <table className={styles.editTable}>
        <thead>
          <tr>
            <th style={{ width: '1%' }}></th>
            <th>Match</th>
            <th>Map to value</th>
            <th>Map to state</th>
            <th>Map to color</th>
            <th style={{ width: '1%' }}></th>
          </tr>
        </thead>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="sortable-field-mappings" direction="vertical">
            {(provided) => (
              <tbody ref={provided.innerRef} {...provided.droppableProps}>
                {rows.map((row, index) => (
                  <ValueMappingEditRow key={index.toString()} mapping={row} index={index} onChange={onChangeMapping} />
                ))}
                {provided.placeholder}
              </tbody>
            )}
          </Droppable>
        </DragDropContext>
      </table>
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

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '980px',
  }),
  editTable: css({
    width: '100%',

    'thead tr': {},

    'tbody tr:nth-child(odd)': {
      background: theme.colors.background.secondary,
    },

    ' th, td': {
      padding: theme.spacing(1),
      textAlign: 'center',
    },

    ' td': {},
  }),
});
