import React, { useMemo, useCallback, FC } from 'react';
import _ from 'lodash';

import { LegacyForms } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { Variable } from 'app/types/templates';
const { Select } = LegacyForms;

export interface Props {
  onChange: (value: string | undefined) => void;
  options: Array<SelectableValue<string>>;
  isSearchable: boolean;
  value: string;
  placeholder?: string;
  className?: string;
  variables?: Variable[];
}

export const MetricSelect: FC<Props> = props => {
  const { value, placeholder, className, isSearchable, onChange } = props;
  const options = useSelectOptions(props);
  const selected = useSelectedOption(options, value);
  const onChangeValue = useCallback((selectable: SelectableValue<string>) => onChange(selectable.value), [onChange]);

  return (
    <Select
      className={className}
      isMulti={false}
      isClearable={false}
      backspaceRemovesValue={false}
      onChange={onChangeValue}
      options={options}
      isSearchable={isSearchable}
      maxMenuHeight={500}
      placeholder={placeholder}
      noOptionsMessage={() => 'No options found'}
      value={selected}
    />
  );
};

const useSelectOptions = ({ variables = [], options }: Props): Array<SelectableValue<string>> => {
  return useMemo(() => {
    if (!Array.isArray(variables) || variables.length === 0) {
      return options;
    }

    return [
      {
        label: 'Template Variables',
        options: variables.map(({ name }) => ({
          label: `$${name}`,
          value: `$${name}`,
        })),
      },
      ...options,
    ];
  }, [variables, options]);
};

const useSelectedOption = (options: Array<SelectableValue<string>>, value: string): SelectableValue<string> => {
  return useMemo(() => {
    const allOptions = options.every(o => o.options) ? _.flatten(options.map(o => o.options)) : options;
    return allOptions.find(option => option.value === value);
  }, [options, value]);
};
