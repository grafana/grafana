import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import {
  type GrafanaTheme2,
  type SelectableValue,
  type StandardEditorProps,
  type FieldNamePickerBaseNameMode,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { type ColorDimensionConfig } from '@grafana/schema';
import { Combobox, ColorPicker, useStyles2 } from '@grafana/ui';
import { useFieldDisplayNames, useMatcherSelectOptions } from '@grafana/ui/internal';

interface ColorDimensionSettings {
  isClearable?: boolean;
  baseNameMode?: FieldNamePickerBaseNameMode;
  placeholder?: string;
}

export const ColorDimensionEditor = (props: StandardEditorProps<ColorDimensionConfig, ColorDimensionSettings>) => {
  const fixedColorOption = useMemo(
    () => ({
      label: t('dimensions.color-dimension-editor.label-fixed-color', 'Fixed color'),
      value: '_____fixed_____',
    }),
    []
  );
  const { value, context, onChange, item, id } = props;

  const defaultColor = 'dark-green';

  const styles = useStyles2(getStyles);
  const fieldName = value?.field;
  const isFixed = value && Boolean(!fieldName) && value?.fixed;
  const names = useFieldDisplayNames(context.data);
  const selectOptions = useMatcherSelectOptions(names, fieldName, {
    baseNameMode: item.settings?.baseNameMode,
    firstItem: fixedColorOption,
  });

  const onSelectChange = useCallback(
    (selection: SelectableValue<string> | null) => {
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
        <Combobox
          id={id}
          value={selectedOption}
          options={selectOptions}
          onChange={onSelectChange}
          noOptionsMessage={t('dimensions.color-dimension-editor.noOptionsMessage-no-fields-found', 'No fields found')}
          placeholder={item.settings?.placeholder}
          {...(item.settings?.isClearable ? { isClearable: true } : { isClearable: false })} // silly TS issue
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
