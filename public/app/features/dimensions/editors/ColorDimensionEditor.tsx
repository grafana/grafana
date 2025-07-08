import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { GrafanaTheme2, SelectableValue, StandardEditorProps, FieldNamePickerBaseNameMode } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ColorDimensionConfig } from '@grafana/schema';
import { Select, ColorPicker, useStyles2 } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/internal';

interface ColorDimensionSettings {
  isClearable?: boolean;
  baseNameMode?: FieldNamePickerBaseNameMode;
  placeholder?: string;
}

export const ColorDimensionEditor = (props: StandardEditorProps<ColorDimensionConfig, ColorDimensionSettings>) => {
  const fixedColorOption: SelectableValue<string> = useMemo(
    () => ({
      label: t('dimensions.color-dimension-editor.label-fixed-color', 'Fixed color'),
      value: '_____fixed_____',
    }),
    []
  );
  const { value, context, onChange, item } = props;

  const defaultColor = 'dark-green';

  const styles = useStyles2(getStyles);
  const fieldName = value?.field;
  const isFixed = value && Boolean(!fieldName) && value?.fixed;
  const names = useFieldDisplayNames(context.data);
  const selectOptions = useSelectOptions(names, fieldName, fixedColorOption, undefined, item.settings?.baseNameMode);

  const onSelectChange = useCallback(
    (selection: SelectableValue<string>) => {
      if (!selection) {
        onChange(undefined);
        return;
      }

      const field = selection.value;
      if (field && field !== fixedColorOption.value) {
        onChange({
          ...value,
          field,
        });
      } else {
        const fixed = value?.fixed ?? defaultColor;
        onChange({
          ...value,
          field: undefined,
          fixed,
        });
      }
    },
    [fixedColorOption.value, onChange, value]
  );

  const onColorChange = useCallback(
    (c: string) => {
      onChange({
        field: undefined,
        fixed: c ?? defaultColor,
      });
    },
    [onChange]
  );

  const selectedOption = isFixed ? fixedColorOption : selectOptions.find((v) => v.value === fieldName);
  return (
    <>
      <div className={styles.container}>
        <Select
          value={selectedOption}
          options={selectOptions}
          onChange={onSelectChange}
          noOptionsMessage={t('dimensions.color-dimension-editor.noOptionsMessage-no-fields-found', 'No fields found')}
          isClearable={item.settings?.isClearable}
          placeholder={item.settings?.placeholder}
        />
        {isFixed && (
          <div className={styles.picker}>
            <ColorPicker color={value?.fixed} onChange={onColorChange} enableNamedColors={true} />
          </div>
        )}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
  }),
  picker: css({
    paddingLeft: theme.spacing(1),
  }),
});
