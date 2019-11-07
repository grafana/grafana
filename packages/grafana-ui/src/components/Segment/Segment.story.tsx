import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { SelectableValue } from '@grafana/data';
import { Segment } from './';
import { UseState } from '../../utils/storybook/UseState';

const SegmentStories = storiesOf('UI/Segment/SegmentSync', module);

const AddButton = (
  <a className="gf-form-label query-part">
    <i className="fa fa-plus" />
  </a>
);

const toOption = (value: any) => ({ label: value, value: value });

SegmentStories.add('Array Options', () => {
  const options = ['Option1', 'Option2', 'OptionWithLooongLabel', 'Option4'].map(toOption);
  return (
    <UseState initialState={options[0].value}>
      {(value, updateValue) => (
        <>
          <div className="gf-form-inline">
            <div className="gf-form">
              <span className="gf-form-label width-8 query-keyword">Segment Name</span>
            </div>
            <Segment
              value={value}
              options={options}
              onChange={(value: SelectableValue<string>) => {
                updateValue(value);
                action('Segment value changed')(value);
              }}
            />
            <Segment
              Component={AddButton}
              onChange={(value: SelectableValue<string>) => action('New value added')(value)}
              options={options}
            />
          </div>
        </>
      )}
    </UseState>
  );
});

const groupedOptions = [
  { label: 'Names', options: ['Jane', 'Tom', 'Lisa'].map(toOption) },
  { label: 'Prime', options: [2, 3, 5, 7, 11, 13].map(toOption) },
];

SegmentStories.add('Grouped Array Options', () => {
  return (
    <UseState initialState={groupedOptions[0].options[0].value}>
      {(value, updateValue) => (
        <>
          <div className="gf-form-inline">
            <div className="gf-form">
              <span className="gf-form-label width-8 query-keyword">Segment Name</span>
            </div>
            <Segment
              value={value}
              options={groupedOptions}
              onChange={(value: SelectableValue<string>) => {
                updateValue(value);
                action('Segment value changed')(value);
              }}
            />
            <Segment
              Component={AddButton}
              onChange={value => action('New value added')(value)}
              options={groupedOptions}
            />
          </div>
        </>
      )}
    </UseState>
  );
});

SegmentStories.add('With custom options allowed', () => {
  const options = ['Option1', 'Option2', 'OptionWithLooongLabel', 'Option4'].map(toOption);
  return (
    <UseState initialState={options[0].value}>
      {(value, updateValue) => (
        <>
          <div className="gf-form-inline">
            <div className="gf-form">
              <span className="gf-form-label width-8 query-keyword">Segment Name</span>
            </div>
            <Segment
              allowCustomValue
              value={value}
              options={options}
              onChange={(value: SelectableValue<string>) => {
                updateValue(value);
                action('Segment value changed')(value);
              }}
            />
            <Segment
              allowCustomValue
              Component={AddButton}
              onChange={(value: SelectableValue<string>) => action('New value added')(value)}
              options={options}
            />
          </div>
        </>
      )}
    </UseState>
  );
});

const CustomLabelComponent = ({ value }: any) => <div className="gf-form-label">custom({value})</div>;

SegmentStories.add('Custom Label Field', () => {
  return (
    <UseState initialState={groupedOptions[0].options[0].value}>
      {(value, setValue) => (
        <>
          <div className="gf-form-inline">
            <div className="gf-form">
              <span className="gf-form-label width-8 query-keyword">Segment Name</span>
            </div>
            <Segment
              Component={<CustomLabelComponent value={value} />}
              options={groupedOptions}
              onChange={(value: SelectableValue<string>) => {
                setValue(value);
                action('Segment value changed')(value);
              }}
            />
            <Segment
              Component={AddButton}
              onChange={value => action('New value added')(value)}
              options={groupedOptions}
            />
          </div>
        </>
      )}
    </UseState>
  );
});
