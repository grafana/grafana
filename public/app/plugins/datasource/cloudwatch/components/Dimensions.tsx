import React, { FunctionComponent, Fragment, useState, useEffect } from 'react';
import isEqual from 'lodash/isEqual';
import { SelectableValue } from '@grafana/data';
import { SegmentAsync } from '@grafana/ui';
import { SelectableStrings } from '../types';

export interface Props {
  dimensions: { [key: string]: string | string[] };
  onChange: (dimensions: { [key: string]: string }) => void;
  loadValues: (key: string) => Promise<SelectableStrings>;
  loadKeys: () => Promise<SelectableStrings>;
}

const removeText = '-- remove dimension --';
const removeOption: SelectableValue<string> = { label: removeText, value: removeText };

// The idea of this component is that is should only trigger the onChange event in the case
// there is a complete dimension object. E.g, when a new key is added is doesn't have a value.
// That should not trigger onChange.
export const Dimensions: FunctionComponent<Props> = ({ dimensions, loadValues, loadKeys, onChange }) => {
  const [data, setData] = useState(dimensions);

  useEffect(() => {
    const completeDimensions = Object.entries(data).reduce(
      (res, [key, value]) => (value ? { ...res, [key]: value } : res),
      {}
    );
    if (!isEqual(completeDimensions, dimensions)) {
      onChange(completeDimensions);
    }
  }, [data]);

  const excludeUsedKeys = (options: SelectableStrings) => {
    return options.filter(({ value }) => !Object.keys(data).includes(value));
  };

  return (
    <>
      {Object.entries(data).map(([key, value], index) => (
        <Fragment key={index}>
          <SegmentAsync
            allowCustomValue
            value={key}
            loadOptions={() => loadKeys().then(keys => [removeOption, ...excludeUsedKeys(keys)])}
            onChange={({ value: newKey }) => {
              const { [key]: value, ...newDimensions } = data;
              if (newKey === removeText) {
                setData({ ...newDimensions });
              } else {
                setData({ ...newDimensions, [newKey]: '' });
              }
            }}
          />
          <label className="gf-form-label query-segment-operator">=</label>
          <SegmentAsync
            allowCustomValue
            value={value}
            placeholder="select dimension value"
            loadOptions={() => loadValues(key)}
            onChange={({ value: newValue }) => setData({ ...data, [key]: newValue })}
          />
          {Object.values(data).length > 1 && index + 1 !== Object.values(data).length && (
            <label className="gf-form-label query-keyword">AND</label>
          )}
        </Fragment>
      ))}
      {Object.values(data).every(v => v) && (
        <SegmentAsync
          allowCustomValue
          Component={
            <a className="gf-form-label query-part">
              <i className="fa fa-plus" />
            </a>
          }
          loadOptions={() => loadKeys().then(excludeUsedKeys)}
          onChange={({ value: newKey }) => setData({ ...data, [newKey]: '' })}
        />
      )}
    </>
  );
};
