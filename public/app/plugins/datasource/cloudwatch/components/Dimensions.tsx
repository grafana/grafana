import React, { FunctionComponent, Fragment, useState, useEffect } from 'react';
import isEqual from 'lodash/isEqual';
import { SelectableValue } from '@grafana/data';
import { Segment, SegmentAsync } from '@grafana/ui';

export interface Props {
  dimensions: { [key: string]: string };
  onChange: (dimensions: { [key: string]: string }) => void;
  loadValues: (key: string) => Promise<SelectableValue<string>[]>;
  loadKeys: () => Promise<SelectableValue<string>[]>;
}

const operators: SelectableValue<string>[] = ['='].map(v => ({ label: v, value: v }));
const removeText = '-- remove dimension --';
const removeOption: SelectableValue<string> = { label: removeText, value: removeText };

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

  const excludeUsedKeys = (options: Array<SelectableValue<string>>) =>
    options.filter(({ value }) => !Object.keys(data).includes(value));

  return (
    <>
      {Object.entries(data).map(([key, value], index) => (
        <Fragment key={index}>
          <SegmentAsync
            value={key}
            loadOptions={() => loadKeys().then(keys => [removeOption, ...excludeUsedKeys(keys)])}
            onChange={newKey => {
              let { [key]: value, ...newDimensions } = data;
              if (newKey === removeText) {
                setData({ ...newDimensions });
              } else {
                setData({ ...newDimensions, [newKey]: '' });
              }
            }}
          />
          <Segment
            Component={<a className="gf-form-label query-segment-operator">=</a>}
            onChange={() => {}}
            options={operators}
          />
          <SegmentAsync
            value={value || 'select dimension value'}
            loadOptions={() => loadValues(key)}
            onChange={newValue => setData({ ...data, [key]: newValue })}
          />
        </Fragment>
      ))}
      {Object.values(data).every(v => v) && (
        <SegmentAsync
          Component={
            <a className="gf-form-label query-part">
              <i className="fa fa-plus" />
            </a>
          }
          loadOptions={() => loadKeys().then(excludeUsedKeys)}
          onChange={newKey => setData({ ...data, [newKey]: '' })}
        />
      )}
    </>
  );
};
