import React, { SFC } from 'react';
import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';

export interface Props {
  values: string[];
  onChange: (values: string[]) => void;
}

const options: SelectableValue<string>[] = ['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount'].map(value => ({
  label: value,
  value: value,
}));

const removeText = '-- remove stat --';
const removeOption: SelectableValue<string> = { label: removeText, value: removeText };

export const Stats: SFC<Props> = ({ values, onChange }) => (
  <>
    {values.map((value, index) => (
      <Segment
        value={value}
        options={[removeOption, ...options]}
        onChange={value =>
          onChange(
            value === removeText
              ? values.filter((_, i) => i !== index)
              : values.map((v, i) => (i === index ? value : v))
          )
        }
      />
    ))}
    <Segment
      Component={
        <a className="gf-form-label query-part">
          <i className="fa fa-plus" />
        </a>
      }
      onChange={value => onChange([...values, value])}
      options={options}
    />
  </>
);
