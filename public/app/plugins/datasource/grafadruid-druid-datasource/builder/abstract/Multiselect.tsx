import React from 'react';
import { InlineField, MultiSelect as MultiSelectField } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { QueryBuilderFieldProps } from './types';
import { onBuilderChange } from '.';

interface Props extends QueryBuilderFieldProps {
  entries: Record<string | number, string>;
}

export const MultiSelect = (props: Props) => {
  const onChange = (options: Array<SelectableValue<string>>) => {
    if (null !== options) {
      onBuilderChange(
        props,
        options.map((option) => option.value)
      );
    }
  };
  const entries = Object.entries(props.entries).map((entry) => {
    return { value: entry[0], label: String(entry[1]) };
  });
  return (
    <InlineField label={props.label} tooltip={props.description} grow>
      <MultiSelectField
        options={entries}
        value={props.options.builder}
        onChange={onChange}
        isClearable={true}
        placeholder={props.description}
      />
    </InlineField>
  );
};
