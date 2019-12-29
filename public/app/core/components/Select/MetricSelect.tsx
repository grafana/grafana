import React, { FC, memo } from 'react';
import _ from 'lodash';

import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { Variable } from 'app/types/templates';

export interface Props {
  onChange: (value: string) => void;
  options: Array<SelectableValue<string>>;
  isSearchable?: boolean;
  value: string;
  placeholder?: string;
  className?: string;
  variables?: Variable[];
}

export const getSelectedOption = (options: Array<SelectableValue<string>>, value: string) => {
  const allOptions = options.every(o => o.options) ? _.flatten(options.map(o => o.options)) : options;
  return allOptions.find(option => option.value === value);
};

export const buildOptions = ({ variables = [], options }: Props) => {
  return variables.length
    ? [
        {
          label: 'Template Variables',
          options: variables.map(({ name }) => ({
            label: `$${name}`,
            value: `$${name}`,
          })),
        },
        ...options,
      ]
    : options;
};

export const compareFn = (nextProps: Props, prevProps: Props) => {
  return nextProps.value === prevProps.value || !_.isEqual(buildOptions(nextProps), buildOptions(prevProps));
};

export const MetricSelect: FC<Props> = memo(props => {
  const { value, placeholder, className, isSearchable = true, onChange } = props;
  const opts = buildOptions(props);

  return (
    <Select
      className={className}
      isMulti={false}
      isClearable={false}
      backspaceRemovesValue={false}
      onChange={item => onChange(item.value)}
      options={opts}
      isSearchable={isSearchable}
      maxMenuHeight={500}
      placeholder={placeholder}
      noOptionsMessage={() => 'No options found'}
      value={getSelectedOption(opts, value)}
    />
  );
}, compareFn);
