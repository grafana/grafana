import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';
import * as React from 'react';

import { Icon } from '../Icon/Icon';

import { SegmentInput, SegmentInputProps } from './SegmentInput';
import { SegmentSection } from './SegmentSection';

const SegmentFrame = ({ children }: React.PropsWithChildren) => (
  <>
    <SegmentSection label="Segment">{children}</SegmentSection>
  </>
);

export const BasicInput = () => {
  const [value, setValue] = useState<string | number>('some text');
  return (
    <SegmentFrame>
      <SegmentInput
        value={value}
        onChange={(text) => {
          setValue(text);
          action('Segment value changed')(text);
        }}
      />
    </SegmentFrame>
  );
};

const meta: Meta<typeof SegmentInput> = {
  title: 'Inputs/SegmentInput',
  component: SegmentInput,
  parameters: {
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
};

export const BasicInputWithPlaceholder = () => {
  const [value, setValue] = useState<string | number>('');
  return (
    <SegmentFrame>
      <SegmentInput
        placeholder="add text"
        value={value}
        onChange={(text) => {
          setValue(text);
          action('Segment value changed')(text);
        }}
      />
    </SegmentFrame>
  );
};

export const BasicInputWithHtmlAttributes = () => {
  const [value, setValue] = useState<string | number>('some text');
  return (
    <SegmentFrame>
      <SegmentInput
        data-testid="segment-input-test"
        id="segment-input"
        value={value}
        onChange={(text) => {
          setValue(text);
          action('Segment value changed')(text);
        }}
      />
    </SegmentFrame>
  );
};

interface InputComponentProps {
  initialValue: string | number;
}

const InputComponent = ({ initialValue }: InputComponentProps) => {
  const [value, setValue] = useState(initialValue);
  return (
    <SegmentInput
      placeholder="add text"
      autofocus
      value={value}
      onChange={(text) => {
        setValue(text);
        action('Segment value changed')(text);
      }}
    />
  );
};

export const InputWithAutoFocus = () => {
  const [inputComponents, setInputComponents] = useState<Array<(props: InputComponentProps) => JSX.Element>>([]);
  return (
    <SegmentFrame>
      {inputComponents.map((InputComponent, i) => (
        <InputComponent initialValue="test" key={i} />
      ))}
      <button
        type="button"
        className="gf-form-label query-part"
        onClick={() => {
          setInputComponents([...inputComponents, InputComponent]);
        }}
      >
        <Icon name="plus" />
      </button>
    </SegmentFrame>
  );
};

export const Basic: StoryFn<React.ComponentType<SegmentInputProps>> = (args: SegmentInputProps) => {
  const [value, setValue] = useState(args.value);

  const props: SegmentInputProps = {
    ...args,
    value,
    onChange: (value) => {
      setValue(value);
      action('onChange fired')({ value });
    },
    onExpandedChange: (expanded) => action('onExpandedChange fired')({ expanded }),
  };

  return (
    <SegmentSection label="Segment:">
      <SegmentInput {...props} />
    </SegmentSection>
  );
};

Basic.parameters = {
  controls: {
    exclude: ['value', 'onChange', 'Component', 'className', 'onExpandedChange'],
  },
};

Basic.args = {
  value: 'Initial input value',
  placeholder: 'Placeholder text',
  disabled: false,
  autofocus: false,
  inputPlaceholder: 'Start typing...',
};

export default meta;
