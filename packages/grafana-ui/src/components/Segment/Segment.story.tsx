import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import { Segment, Icon } from '@grafana/ui';

const AddButton = (
  <a className="gf-form-label query-part">
    <Icon name="plus-circle" />
  </a>
);

const toOption = (value: any) => ({ label: value, value: value });
const options = ['Option1', 'Option2', 'OptionWithLooongLabel', 'Option4'].map(toOption);
const groupedOptions = [
  { label: 'Names', options: ['Jane', 'Tom', 'Lisa'].map(toOption) },
  { label: 'Prime', options: [2, 3, 5, 7, 11, 13].map(toOption) },
];

const SegmentFrame = ({ options, children }: any) => (
  <>
    <div className="gf-form-inline">
      <div className="gf-form">
        <span className="gf-form-label width-8 query-keyword">Segment Name</span>
      </div>
      {children}
      <Segment Component={AddButton} onChange={({ value }) => action('New value added')(value)} options={options} />
    </div>
  </>
);

export const ArrayOptions = () => {
  const [value, setValue] = useState<any>(options[0]);
  return (
    <SegmentFrame options={options}>
      <Segment
        value={value}
        options={options}
        onChange={item => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

export default {
  title: 'Data Source/Segment/SegmentSync',
  component: Segment,
};

export const ArrayOptionsWithPrimitiveValue = () => {
  const [value, setValue] = useState('Option1');
  return (
    <SegmentFrame options={options}>
      <Segment
        value={value}
        options={options}
        onChange={({ value }) => {
          setValue(value);
          action('Segment value changed')(value);
        }}
      />
    </SegmentFrame>
  );
};

export const ArrayOptionsWithPlaceholder = () => {
  const [value, setValue] = useState<any>(undefined);
  return (
    <SegmentFrame options={options}>
      <Segment
        value={value}
        options={options}
        placeholder="Enter a value"
        onChange={item => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

export const GroupedArrayOptions = () => {
  const [value, setValue] = useState<any>(groupedOptions[0].options[0]);
  return (
    <SegmentFrame options={options}>
      <Segment
        value={value}
        options={groupedOptions}
        onChange={item => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

export const CustomOptionsAllowed = () => {
  const [value, setValue] = useState(options[0]);
  return (
    <SegmentFrame options={options}>
      <Segment
        allowCustomValue
        value={value}
        options={options}
        onChange={({ value }) => {
          setValue(value);
          action('Segment value changed')(value);
        }}
      />
    </SegmentFrame>
  );
};

const CustomLabelComponent = ({ value }: any) => <div className="gf-form-label">custom({value})</div>;

export const CustomLabelField = () => {
  const [value, setValue] = useState<any>(groupedOptions[0].options[0].value);
  return (
    <SegmentFrame options={options}>
      <Segment
        Component={<CustomLabelComponent value={value} />}
        options={groupedOptions}
        onChange={({ value }) => {
          setValue(value);
          action('Segment value changed')(value);
        }}
      />
    </SegmentFrame>
  );
};

export const HtmlAttributes = () => {
  const [value, setValue] = useState<any>(options[0]);
  return (
    <SegmentFrame options={options}>
      <Segment
        data-testid="segment-test"
        id="segment-id"
        value={value}
        options={groupedOptions}
        onChange={({ value }) => {
          setValue(value);
          action('Segment value changed')(value);
        }}
      />
    </SegmentFrame>
  );
};
