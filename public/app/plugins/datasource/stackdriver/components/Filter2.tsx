import React, { FunctionComponent, Fragment, useState, useEffect } from 'react';
import _ from 'lodash';
import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';
import { Filter } from '../types';

export interface Props {
  labels: { [key: string]: string[] };
  filters: Filter[];
  onChange: (filters: Filter[]) => void;
}

const removeText = '-- remove filter --';
const operators = ['=', '!=', '=~', '!=~'];

export const Filter2: FunctionComponent<Props> = ({ labels, filters, onChange }) => {
  const toOption: Array<SelectableValue<string>> = (value: any) => ({ label: value, value });

  return (
    <div className="gf-form-inline">
      <label className="gf-form-label query-keyword width-9">Filter</label>
      {filters.map(({ key, operator, value, condition }, index) => (
        <Fragment key={index}>
          <Segment
            allowCustomValue
            value={key}
            options={Object.keys(labels).map(toOption)}
            onChange={({ value: key }) =>
              onChange(filters.map((f, i) => (i === index ? { key, operator, condition, value: '' } : f)))
            }
          />
          <Segment
            value={operator}
            className="gf-form-label query-segment-operator"
            options={operators.map(toOption)}
            onChange={({ value: operator }) => onChange(filters.map((f, i) => (i === index ? { ...f, operator } : f)))}
          />
          <Segment
            allowCustomValue
            value={value}
            placeholder="select value"
            options={labels[key].map(toOption)}
            onChange={({ value }) => onChange(filters.map((f, i) => (i === index ? { ...f, value } : f)))}
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
              <i className="fa fa-plus" />
            </a>
          }
          options={Object.keys(labels)
            .filter(key => !filters.includes(key))
            .map(toOption)}
          onChange={({ value: key }) => onChange([...filters, { key, operator: '=', condition: 'AND', value: '' }])}
        />
      )}
      <div className="gf-form gf-form--grow">
        <label className="gf-form-label gf-form-label--grow"></label>
      </div>
    </div>
  );
};
