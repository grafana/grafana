import React, { FunctionComponent } from 'react';
import { SelectableStrings } from '../types';
import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';

export interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  variableOptionGroup: SelectableValue<string>;
  stats: SelectableStrings;
}

const removeText = '-- remove stat --';
const removeOption: SelectableValue<string> = { label: removeText, value: removeText };

export const Stats: FunctionComponent<Props> = ({ stats, values, onChange, variableOptionGroup }) => (
  <>
    {values &&
      values.map((value, index) => (
        <Segment
          allowCustomValue
          key={value + index}
          value={value}
          options={[removeOption, ...stats, variableOptionGroup]}
          onChange={({ value }) =>
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
      allowCustomValue
      onChange={({ value }) => onChange([...values, value])}
      options={[...stats.filter(({ value }) => !values.includes(value)), variableOptionGroup]}
    />
  </>
);
