import { t } from '@grafana/i18n';
import { TablePillCellOptions } from '@grafana/schema';
import { Field, ColorPicker, RadioButtonGroup, Stack, Button, Input, IconButton, Select } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

const colorModeOptions: Array<{ value: 'auto' | 'fixed' | 'mapped'; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'fixed', label: 'Fixed color' },
  { value: 'mapped', label: 'Value mapping' },
];

export const PillCellOptionsEditor = ({ cellOptions, onChange }: TableCellEditorProps<TablePillCellOptions>) => {
  const colorMode = cellOptions.colorMode || 'auto';

  const onColorModeChange = (mode: 'auto' | 'fixed' | 'mapped') => {
    const updatedOptions = { ...cellOptions, colorMode: mode };
    onChange(updatedOptions);
  };

  const onColorChange = (color: string) => {
    const updatedOptions = { ...cellOptions, color };
    onChange(updatedOptions);
  };

  const onAddMapping = () => {
    const newMapping = { value: '', color: '#FF780A', matchType: 'exact' as const };
    const updatedMappings = [...(cellOptions.valueMappings || []), newMapping];
    const updatedOptions = { ...cellOptions, valueMappings: updatedMappings };
    onChange(updatedOptions);
  };

  const onRemoveMapping = (index: number) => {
    const updatedMappings = (cellOptions.valueMappings || []).filter((_, i) => i !== index);
    const updatedOptions = { ...cellOptions, valueMappings: updatedMappings };
    onChange(updatedOptions);
  };

  const onMappingChange = (index: number, field: 'value' | 'color' | 'matchType', newValue: string) => {
    const updatedMappings = (cellOptions.valueMappings || []).map((mapping, i) => {
      if (i === index) {
        return { ...mapping, [field]: newValue };
      }
      return mapping;
    });
    const updatedOptions = { ...cellOptions, valueMappings: updatedMappings };
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
        <>
          <Field
            label={t('table.pill-cell-options-editor.label-default-color', 'Default Color')}
            description={t(
              'table.pill-cell-options-editor.description-default-color',
              'Color used for values that are not explicitly mapped'
            )}
            noMargin
          >
            <ColorPicker color={cellOptions.color || '#FF780A'} onChange={onColorChange} enableNamedColors={false} />
          </Field>

          <Field
            label={t('table.pill-cell-options-editor.label-value-mappings', 'Value Mappings')}
            description={t(
              'table.pill-cell-options-editor.description-value-mappings',
              'Map specific values to specific colors'
            )}
            noMargin
          >
            <Stack direction="column" gap={1}>
              {(cellOptions.valueMappings || []).map((mapping, index) => (
                <Stack key={index} direction="row" gap={1} alignItems="center">
                  <Input
                    placeholder={t('table.pill-cell-options-editor.placeholder-value', 'Value')}
                    value={mapping.value}
                    onChange={(e) => onMappingChange(index, 'value', e.currentTarget.value)}
                    width={20}
                  />
                  <Select
                    value={mapping.matchType || 'exact'}
                    onChange={(option) => onMappingChange(index, 'matchType', option.value || 'exact')}
                    options={[
                      { label: t('table.pill-cell-options-editor.match-exact', 'Exact'), value: 'exact' },
                      { label: t('table.pill-cell-options-editor.match-contains', 'Contains'), value: 'contains' },
                    ]}
                    width={12}
                  />
                  <ColorPicker
                    color={mapping.color}
                    onChange={(color) => onMappingChange(index, 'color', color)}
                    enableNamedColors={false}
                  />
                  <IconButton
                    name="trash-alt"
                    onClick={() => onRemoveMapping(index)}
                    tooltip={t('table.pill-cell-options-editor.remove-mapping', 'Remove mapping')}
                  />
                </Stack>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={onAddMapping}
                icon="plus"
              >
                {t('table.pill-cell-options-editor.add-mapping', 'Add mapping')}
              </Button>
            </Stack>
          </Field>
        </>
      )}
    </Stack>
  );
};
