import React, { FunctionComponent } from 'react';
import _ from 'lodash';
import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';

export interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  variableOptionGroup: SelectableValue<string>;
  groupBys: string[];
}

const removeText = '-- remove group by --';
const removeOption: SelectableValue<string> = { label: removeText, value: removeText };
const groupBysToGroupedOptions = (groupBys: string[]) => {
  const groups = groupBys.reduce((acc: any, curr: string) => {
    const arr = curr.split('.').map(_.startCase);
    const group = (arr.length === 2 ? arr : _.initial(arr)).join(' ');
    const option = {
      value: curr,
      label: _.last(arr),
    };
    if (acc[group]) {
      acc[group] = [...acc[group], option];
    } else {
      acc[group] = [option];
    }
    return acc;
  }, {});
  return Object.entries(groups).map(([label, options]) => ({ label, options, expanded: true }), []);
};

export const GroupBys: FunctionComponent<Props> = ({ groupBys = [], values = [], onChange, variableOptionGroup }) => {
  const options = [removeOption, ...groupBysToGroupedOptions(groupBys), variableOptionGroup];
  return (
    <div className="gf-form-inline">
      <label className="gf-form-label query-keyword width-9">Group By</label>
      {values &&
        values.map((value, index) => (
          <Segment
            allowCustomValue
            key={value + index}
            value={{ label: _.startCase(value.replace(/\./g, ' ')), value: value }}
            options={options}
            onChange={({ value }) =>
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
              <i className="fa fa-plus" />
            </a>
          }
          allowCustomValue
          onChange={({ value }) => onChange([...values, value])}
          options={[
            ...groupBysToGroupedOptions(groupBys.filter(groupBy => !values.includes(groupBy))),
            variableOptionGroup,
          ]}
        />
      )}
      <div className="gf-form gf-form--grow">
        <label className="gf-form-label gf-form-label--grow"></label>
      </div>
    </div>
  );
};
