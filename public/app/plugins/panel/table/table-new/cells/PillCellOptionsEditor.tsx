import { t } from '@grafana/i18n';
import { TablePillCellOptions } from '@grafana/schema';
import { Field, ColorPicker, RadioButtonGroup, Stack, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

const colorModeOptions: Array<{ value: 'auto' | 'fixed' | 'mapped'; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'fixed', label: 'Fixed color' },
  { value: 'mapped', label: 'Value mapping' },
];

export const PillCellOptionsEditor = ({ cellOptions, onChange }: TableCellEditorProps<TablePillCellOptions>) => {
  const colorMode = cellOptions.colorMode || 'auto';
  const wrapText = cellOptions.wrapText ?? false;

  const onColorModeChange = (mode: 'auto' | 'fixed' | 'mapped') => {
    const updatedOptions = { ...cellOptions, colorMode: mode };
    onChange(updatedOptions);
  };

  const onColorChange = (color: string) => {
    const updatedOptions = { ...cellOptions, color };
    onChange(updatedOptions);
  };

  const onWrapTextChange = (event: React.FormEvent<HTMLInputElement>) => {
    const updatedOptions = { ...cellOptions, wrapText: event.currentTarget.checked };
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

      {colorMode === 'mapped' && (
        <Field
          label={t('table.pill-cell-options-editor.label-value-mappings-info', 'Value Mappings')}
          description={t(
            'table.pill-cell-options-editor.description-value-mappings-info',
            'For Value Mappings either use the global table Value Mappings or the Field overrides Value Mappings. The default will fall back to the Color Scheme. '
          )}
          noMargin
        >
          <div>&nbsp;</div>
        </Field>
      )}

      <Field
        label={t('table.pill-cell-options-editor.label-wrap-text', 'Wrap text')}
        description={t(
          'table.pill-cell-options-editor.description-wrap-text',
          'Allow pills to wrap to new lines when they exceed the cell width. When disabled, pills will be truncated.'
        )}
        noMargin
      >
        <Switch value={wrapText} onChange={onWrapTextChange} />
      </Field>
    </Stack>
  );
};
