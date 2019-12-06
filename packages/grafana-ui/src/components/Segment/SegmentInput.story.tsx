import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
const SegmentStories = storiesOf('UI/Segment/SegmentInput', module);
import { SegmentInput } from '.';
import { UseState } from '../../utils/storybook/UseState';

SegmentStories.add('Segment Input', () => {
  return (
    <UseState initialState={'some text'}>
      {(value, updateValue) => (
        <>
          <div className="gf-form-inline">
            <div className="gf-form">
              <span className="gf-form-label width-8 query-keyword">Segment Name</span>
            </div>
            <SegmentInput
              value={value}
              onChange={text => {
                updateValue(text as string);
                action('Segment value changed')(text);
              }}
            />
          </div>
        </>
      )}
    </UseState>
  );
});
