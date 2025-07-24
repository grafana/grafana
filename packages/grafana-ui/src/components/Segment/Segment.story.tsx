import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';
import * as React from 'react';

import { SelectableValue } from '@grafana/data';

import { Icon } from '../Icon/Icon';

import { Segment, SegmentSyncProps } from './Segment';
import { SegmentSection } from './SegmentSection';

const AddButton = (
  <span className="gf-form-label query-part">
    <Icon name="plus-circle" />
  </span>
);

function toOption<T>(value: T) {
  return {
    label: `${value}`,
    value: value,
  };
}
const options = ['Option1', 'Option2', 'OptionWithLooongLabel', 'Option4'].map(toOption);
const groupedOptions = [
  { label: 'Names', options: ['Jane', 'Tom', 'Lisa'].map(toOption) },
  { label: 'Prime', options: [2, 3, 5, 7, 11, 13].map(toOption) },
];

const SegmentFrame = ({
  options,
  children,
}: {
  options: Array<SelectableValue<string | number>>;
  children: React.ReactNode;
}) => (
  <>
    <SegmentSection label="Segment">
      {children}
      <Segment Component={AddButton} onChange={({ value }) => action('New value added')(value)} options={options} />
    </SegmentSection>
  </>
);

export const ArrayOptions = () => {
  const [value, setValue] = useState<SelectableValue<string>>(options[0]);
  return (
    <SegmentFrame options={options}>
      <Segment
        value={value}
        options={options}
        onChange={(item) => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

const meta: Meta<typeof Segment> = {
  title: 'Inputs/Segment',
  component: Segment,
  parameters: {
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
};

export const ArrayOptionsWithPrimitiveValue = () => {
  const [value, setValue] = useState<string | undefined>('Option1');
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
  const [value, setValue] = useState<SelectableValue<string>>();
  return (
    <SegmentFrame options={options}>
      <Segment
        value={value}
        options={options}
        placeholder="Enter a value"
        onChange={(item) => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

export const GroupedArrayOptions = () => {
  const [value, setValue] = useState<SelectableValue<string | number>>(groupedOptions[0].options[0]);
  return (
    <SegmentFrame options={groupedOptions}>
      <Segment
        value={value}
        options={groupedOptions}
        onChange={(item) => {
          setValue(item);
          action('Segment value changed')(item.value);
        }}
      />
    </SegmentFrame>
  );
};

export const CustomOptionsAllowed = () => {
  const [value, setValue] = useState<SelectableValue<string | number>>(options[0]);
  return (
    <SegmentFrame options={options}>
      <Segment
        allowCustomValue
        value={value}
        options={options}
        onChange={(value) => {
          setValue(value);
          action('Segment value changed')(value);
        }}
      />
    </SegmentFrame>
  );
};

const CustomLabelComponent = ({ value }: SelectableValue<string | number>) => (
  <div className="gf-form-label">custom({value})</div>
);

export const CustomLabelField = () => {
  const [value, setValue] = useState<string | number | undefined>(groupedOptions[0].options[0].value);
  return (
    <SegmentFrame options={groupedOptions}>
      <Segment<string>
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
  const [value, setValue] = useState<SelectableValue<string | number>>(groupedOptions[0].options[0]);
  return (
    <SegmentFrame options={groupedOptions}>
      <Segment
        data-testid="segment-test"
        id="segment-id"
        value={value}
        options={groupedOptions}
        onChange={(value) => {
          setValue(value);
          action('Segment value changed')(value);
        }}
      />
    </SegmentFrame>
  );
};

export const Basic: StoryFn<React.ComponentType<SegmentSyncProps<string>>> = (args: SegmentSyncProps<string>) => {
  const [value, setValue] = useState(args.value);

  const props: SegmentSyncProps<string> = {
    ...args,
    value,
    onChange: ({ value }) => {
      setValue(value);
      action('onChange fired')(value);
    },
    onExpandedChange: (expanded) => action('onExpandedChange fired')({ expanded }),
  };

  return (
    <SegmentSection label="Segment:">
      <Segment<string> {...props} />
    </SegmentSection>
  );
};

Basic.parameters = {
  controls: {
    exclude: ['onChange', 'onExpandedChange', 'Component', 'className', 'value'],
  },
};

Basic.args = {
  value: undefined,
  options,
  inputMinWidth: 0,
  allowCustomValue: false,
  placeholder: 'Placeholder text',
  disabled: false,
  autofocus: false,
  allowEmptyValue: false,
  inputPlaceholder: 'Start typing...',
};

export default meta;
