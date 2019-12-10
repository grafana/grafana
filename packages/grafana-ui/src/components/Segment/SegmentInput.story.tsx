import React, { useState } from 'react';
import { storiesOf } from '@storybook/react';
import { SelectableValue } from '@grafana/data';
import { action } from '@storybook/addon-actions';
const SegmentStories = storiesOf('UI/Segment/SegmentInput', module);
import { SegmentInput, Segment } from '.';
import { UseState } from '../../utils/storybook/UseState';

const SegmentFrame = ({ children }: any) => (
  <>
    <div className="gf-form-inline">
      <div className="gf-form">
        <span className="gf-form-label width-8 query-keyword">Segment Name</span>
      </div>
      {children}
    </div>
  </>
);

export const BasicInput = () => {
  const [value, setValue] = useState('some text');
  return (
    <SegmentFrame>
      <SegmentInput
        value={value}
        onChange={text => {
          setValue(text as string);
          action('Segment value changed')(text);
        }}
      />
    </SegmentFrame>
  );
};

export default {
  title: 'UI/Segment/SegmentInput',
  component: BasicInput,
};

export const BasicInputWithPlaceholder = () => {
  const [value, setValue] = useState('');
  return (
    <SegmentFrame>
      <SegmentInput
        placeholder="add text"
        value={value}
        onChange={text => {
          setValue(text as string);
          action('Segment value changed')(text);
        }}
      />
    </SegmentFrame>
  );
};
