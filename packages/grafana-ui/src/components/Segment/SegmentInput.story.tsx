import { action } from '@storybook/addon-actions';
import React, { useState } from 'react';

import { SegmentInput, Icon, SegmentSection } from '@grafana/ui';

const SegmentFrame = ({ children }: any) => (
  <>
    <SegmentSection label="Segment Name">{children}</SegmentSection>
  </>
);

export const BasicInput = () => {
  const [value, setValue] = useState('some text');
  return (
    <SegmentFrame>
      <SegmentInput
        value={value}
        onChange={(text) => {
          setValue(text as string);
          action('Segment value changed')(text);
        }}
      />
    </SegmentFrame>
  );
};

export default {
  title: 'Data Source/Segment/SegmentInput',
  component: SegmentInput,
};

export const BasicInputWithPlaceholder = () => {
  const [value, setValue] = useState('');
  return (
    <SegmentFrame>
      <SegmentInput
        placeholder="add text"
        value={value}
        onChange={(text) => {
          setValue(text as string);
          action('Segment value changed')(text);
        }}
      />
    </SegmentFrame>
  );
};

export const BasicInputWithHtmlAttributes = () => {
  const [value, setValue] = useState('some text');
  return (
    <SegmentFrame>
      <SegmentInput
        data-testid="segment-input-test"
        id="segment-input"
        value={value}
        onChange={(text) => {
          setValue(text as string);
          action('Segment value changed')(text);
        }}
      />
    </SegmentFrame>
  );
};

const InputComponent = ({ initialValue }: any) => {
  const [value, setValue] = useState(initialValue);
  return (
    <SegmentInput
      placeholder="add text"
      autofocus
      value={value}
      onChange={(text) => {
        setValue(text as string);
        action('Segment value changed')(text);
      }}
    />
  );
};

export const InputWithAutoFocus = () => {
  const [inputComponents, setInputComponents] = useState<any>([]);
  return (
    <SegmentFrame>
      {inputComponents.map((InputComponent: any, i: number) => (
        <InputComponent initialValue="test" key={i} />
      ))}
      <a
        className="gf-form-label query-part"
        onClick={() => {
          setInputComponents([...inputComponents, InputComponent]);
        }}
      >
        <Icon name="plus" />
      </a>
    </SegmentFrame>
  );
};
