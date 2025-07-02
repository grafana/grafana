import { t } from '@grafana/i18n';
import { TablePillCellOptions } from '@grafana/schema';
import { Field, ColorPicker, RadioButtonGroup, Stack } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

const colorModeOptions: Array<{ value: 'auto' | 'fixed'; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'fixed', label: 'Fixed color' },
];

export const PillCellOptionsEditor = ({ cellOptions, onChange }: TableCellEditorProps<TablePillCellOptions>) => {
  const colorMode = (cellOptions.colorMode === 'mapped' ? 'auto' : cellOptions.colorMode) || 'auto';

  const onColorModeChange = (mode: 'auto' | 'fixed') => {
    const updatedOptions = { ...cellOptions, colorMode: mode };
    onChange(updatedOptions);
  };

  const onColorChange = (color: string) => {
    const updatedOptions = { ...cellOptions, color };
    onChange(updatedOptions);
  };

  return (
    <Stack direction="column" gap={1}>
      <Field
        label={t('table.pill-cell-options-editor.label-color-mode', 'Color Mode')}
        description={t(
          'table.pill-cell-options-editor.description-color-mode',
          'Choose how colors are assigned to pills'
        )}
        noMargin
      >
        <RadioButtonGroup value={colorMode} onChange={onColorModeChange} options={colorModeOptions} />
      </Field>

      {colorMode === 'fixed' && (
        <Field
          label={t('table.pill-cell-options-editor.label-fixed-color', 'Fixed Color')}
          description={t(
            'table.pill-cell-options-editor.description-fixed-color',
            'All pills in this column will use this color'
          )}
          noMargin
        >
          <ColorPicker color={cellOptions.color || '#FF780A'} onChange={onColorChange} enableNamedColors={false} />
        </Field>
      )}
    </Stack>
  );
};
