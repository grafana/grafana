import React, { FunctionComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { Segment, Icon } from '@grafana/ui';
import { labelsToGroupedOptions } from '../functions';
import { systemLabels } from '../constants';

export interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  variableOptionGroup: SelectableValue<string>;
  groupBys: string[];
}

const removeText = '-- remove group by --';
const removeOption: SelectableValue<string> = { label: removeText, value: removeText };

export const GroupBys: FunctionComponent<Props> = ({ groupBys = [], values = [], onChange, variableOptionGroup }) => {
  const options = [removeOption, variableOptionGroup, ...labelsToGroupedOptions([...groupBys, ...systemLabels])];
  return (
    <div className="gf-form-inline">
      <label className="gf-form-label query-keyword width-9">Group By</label>
      {values &&
        values.map((value, index) => (
          <Segment
            allowCustomValue
            key={value + index}
            value={value}
            options={options}
            onChange={({ value = '' }) =>
              onChange(
                value === removeText
                  ? values.filter((_, i) => i !== index)
                  : values.map((v, i) => (i === index ? value : v))
              )
            }
          />
        ))}
      {values.length !== groupBys.length && (
        <Segment
          Component={
            <a className="gf-form-label query-part">
              <Icon name="plus" />
            </a>
          }
          allowCustomValue
          onChange={({ value = '' }) => onChange([...values, value])}
          options={[
            variableOptionGroup,
            ...labelsToGroupedOptions([...groupBys.filter(groupBy => !values.includes(groupBy)), ...systemLabels]),
          ]}
        />
      )}
      <div className="gf-form gf-form--grow">
        <label className="gf-form-label gf-form-label--grow"></label>
      </div>
    </div>
  );
};
