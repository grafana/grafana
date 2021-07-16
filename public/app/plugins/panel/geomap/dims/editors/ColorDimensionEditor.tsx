import React, { FC, useCallback } from 'react';
import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { ColorDimensionConfig } from '../types';
import { Select, ColorPicker } from '@grafana/ui';
import {
  useFieldDisplayNames,
  useSelectOptions,
} from '../../../../../../../packages/grafana-ui/src/components/MatchersUI/utils';

const fixedColorOption: SelectableValue<string> = {
  label: 'Fixed color',
  value: '_____fixed_____',
};

export const ColorDimensionEditor: FC<StandardEditorProps<ColorDimensionConfig, any, any>> = (props) => {
  const { value, context, onChange } = props;

  const fieldName = value?.field;
  const isFixed = Boolean(!fieldName);
  const names = useFieldDisplayNames(context.data);
  const selectOptions = useSelectOptions(names, fieldName, fixedColorOption);

  const onSelectChange = useCallback(
    (selection: SelectableValue<string>) => {
      const field = selection.value;
      if (field && field !== fixedColorOption.value) {
        onChange({
          ...value,
          field,
        });
      } else {
        const fixed = value.fixed ?? 'grey';
        onChange({
          ...value,
          field: undefined,
          fixed,
        });
      }
    },
    [onChange, value]
  );

  const onColorChange = useCallback(
    (c: string) => {
      onChange({
        field: undefined,
        fixed: c ?? 'grey',
      });
    },
    [onChange]
  );

  const selectedOption = isFixed ? fixedColorOption : selectOptions.find((v) => v.value === fieldName);
  return (
    <>
      {isFixed && (
        <div>
          <ColorPicker color={value?.fixed ?? 'grey'} onChange={onColorChange} />
        </div>
      )}
      <Select
        value={selectedOption}
        options={selectOptions}
        onChange={onSelectChange}
        noOptionsMessage="No fields found"
      />
    </>
  );
};
