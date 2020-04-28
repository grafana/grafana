import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import { SelectableValue } from '@grafana/data';
import { SegmentAsync } from './';
import { Icon } from '../Icon/Icon';

const AddButton = (
  <a className="gf-form-label query-part">
    <Icon name="plus" />
  </a>
);

const toOption = (value: any) => ({ label: value, value: value });
const options = ['Option1', 'Option2', 'OptionWithLooongLabel', 'Option4'].map(toOption);

const loadOptions = (options: any): Promise<Array<SelectableValue<string>>> =>
  new Promise(res => setTimeout(() => res(options), 2000));

const SegmentFrame = ({ loadOptions, children }: any) => (
  <>
    <div className="gf-form-inline">
      <div className="gf-form">
        <span className="gf-form-label width-8 query-keyword">Segment Name</span>
      </div>
      {children}
      <SegmentAsync
        Component={AddButton}
        onChange={value => action('New value added')(value)}
        loadOptions={() => loadOptions(options)}
      />
    </div>
  </>
);

export const ArrayOptions = () => {
  const [value, setValue] = useState<any>(options[0]);
  return (
    <SegmentFrame loadOptions={() => loadOptions(options)}>
      <SegmentAsync
        value={value}
        loadOptions={() => loadOptions(options)}
        onChange={item => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

export default {
  title: 'Data Source/Segment/SegmentAsync',
  component: SegmentAsync,
};

export const ArrayOptionsWithPrimitiveValue = () => {
  const [value, setValue] = useState(options[0].value);
  return (
    <SegmentFrame loadOptions={() => loadOptions(options)}>
      <SegmentAsync
        value={value}
        loadOptions={() => loadOptions(options)}
        onChange={({ value }) => {
          setValue(value);
          action('Segment value changed')(value);
        }}
      />
    </SegmentFrame>
  );
};

const groupedOptions: any = [
  { label: 'Names', options: ['Jane', 'Tom', 'Lisa'].map(toOption) },
  { label: 'Prime', options: [2, 3, 5, 7, 11, 13].map(toOption) },
];

export const GroupedArrayOptions = () => {
  const [value, setValue] = useState(groupedOptions[0].options[0]);
  return (
    <SegmentFrame loadOptions={() => loadOptions(groupedOptions)}>
      <SegmentAsync
        value={value}
        loadOptions={() => loadOptions(groupedOptions)}
        onChange={item => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

export const CustomOptionsAllowed = () => {
  const [value, setValue] = useState(groupedOptions[0].options[0]);
  return (
    <SegmentFrame loadOptions={() => loadOptions(groupedOptions)}>
      <SegmentAsync
        allowCustomValue
        value={value}
        loadOptions={() => loadOptions(options)}
        onChange={item => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

const CustomLabelComponent = ({ value }: any) => <div className="gf-form-label">custom({value})</div>;

export const CustomLabel = () => {
  const [value, setValue] = useState(groupedOptions[0].options[0].value);
  return (
    <SegmentFrame loadOptions={() => loadOptions(groupedOptions)}>
      <SegmentAsync
        Component={<CustomLabelComponent value={value} />}
        loadOptions={() => loadOptions(groupedOptions)}
        onChange={({ value }) => {
          setValue(value);
          action('Segment value changed')(value);
        }}
      />
    </SegmentFrame>
  );
};
