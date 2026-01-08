import { css } from '@emotion/css';
import { memo, useCallback, useMemo, useState } from 'react';

import { GrafanaTheme2, MappingType, StandardEditorProps, ValueMapping } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useStyles2, Stack, Icon, ColorPicker, Button, Modal } from '@grafana/ui';

import { MediaType, ResourceFolderName, ResourcePickerSize } from '../../types';
import { ResourcePicker } from '../ResourcePicker';

import { buildEditRowModels, editModelToSaveModel, ValueMappingsEditorModal } from './ValueMappingsEditorModal';

export interface Props extends StandardEditorProps<ValueMapping[]> {
  showIcon?: boolean;
}

export const ValueMappingsEditor = memo((props: Props) => {
  const { value, onChange, item } = props;

  const styles = useStyles2(getStyles);
  const showIconPicker = item.settings?.icon;
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

  const onChangeIcon = useCallback(
    (icon: string | undefined, index: number) => {
      rows[index].result.icon = icon;
      onChange(editModelToSaveModel(rows));
    },
    [rows, onChange]
  );

  return (
    <Stack direction="column">
      <table className={styles.compactTable}>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex.toString()}>
              <td>
                {row.type === MappingType.ValueToText && row.key}
                {row.type === MappingType.RangeToText && (
                  <span>
                    [{row.from ?? '-∞'} - {row.to ?? '∞'}]
                  </span>
                )}
                {row.type === MappingType.RegexToText && row.pattern}
                {row.type === MappingType.SpecialValue && row.specialMatch}
              </td>
              <td>
                <Icon name="arrow-right" />
              </td>
              <td>{row.result.text}</td>
              {row.result.color && (
                <td>
                  <ColorPicker
                    color={row.result.color}
                    onChange={(color) => onChangeColor(color, rowIndex)}
                    enableNamedColors={true}
                  />
                </td>
              )}
              {showIconPicker && row.result.icon && (
                <td data-testid="iconPicker">
                  <ResourcePicker
                    onChange={(icon) => onChangeIcon(icon, rowIndex)}
                    value={row.result.icon}
                    size={ResourcePickerSize.SMALL}
                    folderName={ResourceFolderName.Icon}
                    mediaType={MediaType.Icon}
                    color={row.result.color}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <Button variant="secondary" size="sm" fullWidth onClick={() => setIsEditorOpen(true)}>
        {rows.length > 0 && (
          <span>
            <Trans i18nKey="dimensions.value-mappings-editor.edit-value-mappings">Edit value mappings</Trans>
          </span>
        )}
        {rows.length === 0 && (
          <span>
            <Trans i18nKey="dimensions.value-mappings-editor.add-value-mappings">Add value mappings</Trans>
          </span>
        )}
      </Button>
      <Modal
        isOpen={isEditorOpen}
        title={t('dimensions.value-mappings-editor.title-value-mappings', 'Value mappings')}
        onDismiss={onCloseEditor}
        className={styles.modal}
        closeOnBackdropClick={false}
      >
        <ValueMappingsEditorModal
          value={value}
          onChange={onChange}
          onClose={onCloseEditor}
          showIconPicker={showIconPicker}
        />
      </Modal>
    </Stack>
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
