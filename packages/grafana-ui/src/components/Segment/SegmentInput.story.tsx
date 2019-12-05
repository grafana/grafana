import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
const SegmentStories = storiesOf('UI/Segment/SegmentInput', module);
import { SegmentInput } from '.';
import { UseState } from '../../utils/storybook/UseState';

SegmentStories.add('Array Options', () => {
  return (
    <UseState initialState={'some text' as string}>
      {(value, updateValue) => (
        <>
          <div className="gf-form-inline">
            <div className="gf-form">
              <span className="gf-form-label width-8 query-keyword">Segment Name</span>
            </div>
            <SegmentInput
              width={20}
              value={value}
              onChange={item => {
                updateValue(item as string);
                action('Segment value changed')(item);
              }}
            />
          </div>
        </>
      )}
    </UseState>
  );
});
