import React, { FunctionComponent, Fragment } from 'react';
import _ from 'lodash';
import { SelectableValue } from '@grafana/data';
import { Segment, Icon } from '@grafana/ui';
import { labelsToGroupedOptions, filtersToStringArray, stringArrayToFilters, toOption } from '../functions';
import { Filter } from '../types';

export interface Props {
  labels: { [key: string]: string[] };
  filters: string[];
  onChange: (filters: string[]) => void;
  variableOptionGroup: SelectableValue<string>;
}

const removeText = '-- remove filter --';
const removeOption: SelectableValue<string> = { label: removeText, value: removeText, icon: 'times' };
const operators = ['=', '!=', '=~', '!=~'];

export const LabelFilter: FunctionComponent<Props> = ({
  labels = {},
  filters: filterArray,
  onChange,
  variableOptionGroup,
}) => {
  const filters = stringArrayToFilters(filterArray);

  const options = [removeOption, variableOptionGroup, ...labelsToGroupedOptions(Object.keys(labels))];

  return (
    <div className="gf-form-inline">
      <label className="gf-form-label query-keyword width-9">Filter</label>
      {filters.map(({ key, operator, value, condition }, index) => (
        <Fragment key={index}>
          <Segment
            allowCustomValue
            value={key}
            options={options}
            onChange={({ value: key = '' }) => {
              if (key === removeText) {
                onChange(filtersToStringArray(filters.filter((_, i) => i !== index)));
              } else {
                onChange(
                  filtersToStringArray(
                    filters.map((f, i) => (i === index ? { key, operator, condition, value: '' } : f))
                  )
                );
              }
            }}
          />
          <Segment
            value={operator}
            className="gf-form-label query-segment-operator"
            options={operators.map(toOption)}
            onChange={({ value: operator = '=' }) =>
              onChange(filtersToStringArray(filters.map((f, i) => (i === index ? { ...f, operator } : f))))
            }
          />
          <Segment
            allowCustomValue
            value={value}
            placeholder="add filter value"
            options={
              labels.hasOwnProperty(key) ? [variableOptionGroup, ...labels[key].map(toOption)] : [variableOptionGroup]
            }
            onChange={({ value = '' }) =>
              onChange(filtersToStringArray(filters.map((f, i) => (i === index ? { ...f, value } : f))))
            }
          />
          {filters.length > 1 && index + 1 !== filters.length && (
            <label className="gf-form-label query-keyword">{condition}</label>
          )}
        </Fragment>
      ))}
      {Object.values(filters).every(({ value }) => value) && (
        <Segment
          allowCustomValue
          Component={
            <a className="gf-form-label query-part">
              <Icon name="plus" />
            </a>
          }
          options={[variableOptionGroup, ...labelsToGroupedOptions(Object.keys(labels))]}
          onChange={({ value: key = '' }) =>
            onChange(filtersToStringArray([...filters, { key, operator: '=', condition: 'AND', value: '' } as Filter]))
          }
        />
      )}
      <div className="gf-form gf-form--grow">
        <label className="gf-form-label gf-form-label--grow"></label>
      </div>
    </div>
  );
};
