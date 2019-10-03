import React from 'react';
import { storiesOf } from '@storybook/react';
import { css, cx } from 'emotion';
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

const groupedOptions = {
  Names: ['Jane', 'Tom', 'Lisa'].map(toOption),
  Prime: [2, 3, 5, 7, 11, 13].map(toOption),
};

SegmentStories.add('Grouped Array Options', () => {
  return (
    <UseState initialState={groupedOptions.Prime[2].value}>
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

const CustomLabelComponent = ({ value }: any) => (
  <div
    className={`query-part ${cx(css`
      display: flex;
      align-items: center;
      height: 100%;
      padding: 0 4px;
      .pointer + .pointer {
        margin: 0 2px;
        font-size: 14px;
      }
      .value {
        margin: 0 8px;
      }
    `)}`}
  >
    <span
      className="pointer fa fa-arrow-left"
      onClick={e => {
        e.stopPropagation();
        action('Left arrow was clicked')();
      }}
    />
    <span className="pointer fa fa-question-circle" onMouseEnter={() => action('onMouseEnter question mark')()} />
    <a className="value">{value}</a>
    <span
      onClick={e => {
        e.stopPropagation();
        action('Remove was clicked')();
      }}
      className="pointer fa fa-remove"
    />
    <span
      className="pointer fa fa-arrow-right"
      onClick={e => {
        e.stopPropagation();
        action('Right arrow was clicked')();
      }}
    />
  </div>
);

SegmentStories.add('Custom Label Field', () => {
  return (
    <UseState initialState={groupedOptions.Prime[2].value}>
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
