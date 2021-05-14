import React, { useCallback, useMemo, useState } from 'react';
import { GrafanaTheme2, MappingType, ValueMapping } from '@grafana/data';
import { Button } from '../Button/Button';
import { Modal } from '../Modal/Modal';
import { useStyles2 } from '../../themes';
import { css } from '@emotion/css';
import { buildEditRowModels, editModelToSaveModel, ValueMappingsEditorModal } from './ValueMappingsEditorModal';
import { Icon } from '../Icon/Icon';
import { VerticalGroup } from '../Layout/Layout';
import { ColorPicker } from '../ColorPicker/ColorPicker';

export interface Props {
  value: ValueMapping[];
  onChange: (valueMappings: ValueMapping[]) => void;
}

export const ValueMappingsEditor = React.memo(({ value, onChange }: Props) => {
  const styles = useStyles2(getStyles);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const onCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
  }, [setIsEditorOpen]);

  const rows = useMemo(() => buildEditRowModels(value), [value]);

  const onChangeColor = useCallback(
    (color: string, index: number) => {
      rows[index].result.color = color;
      onChange(editModelToSaveModel(rows));
    },
    [rows, onChange]
  );

  return (
    <VerticalGroup>
      <table className={styles.compactTable}>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex.toString()}>
              <td>
                {row.type === MappingType.ValueToText && row.key}
                {row.type === MappingType.RangeToText && (
                  <span>
                    [{row.from} - {row.to}]
                  </span>
                )}
                {row.type === MappingType.SpecialValue && row.specialMatch}
              </td>
              <td>
                <Icon name="arrow-right" />
              </td>
              <td>{row.result.text}</td>
              <td>
                {row.result.color && (
                  <ColorPicker
                    color={row.result.color}
                    onChange={(color) => onChangeColor(color, rowIndex)}
                    enableNamedColors={true}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Button variant="secondary" size="sm" fullWidth onClick={() => setIsEditorOpen(true)}>
        {rows.length > 0 && <span>Edit value mappings</span>}
        {rows.length === 0 && <span>Add value mappings</span>}
      </Button>
      <Modal
        isOpen={isEditorOpen}
        title="Value mappings"
        onDismiss={onCloseEditor}
        className={styles.modal}
        closeOnBackdropClick={false}
      >
        <ValueMappingsEditorModal value={value} onChange={onChange} onClose={onCloseEditor} />
      </Modal>
    </VerticalGroup>
  );
});

ValueMappingsEditor.displayName = 'ValueMappingsEditor';

export const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '980px',
  }),
  compactTable: css({
    width: '100%',
    'tbody td': {
      padding: theme.spacing(0.5),
    },
  }),
});
