import React from 'react';
import { storiesOf } from '@storybook/react';
import { css, cx } from 'emotion';
import { action } from '@storybook/addon-actions';

import { SelectableValue } from '@grafana/data';
import { SegmentAsync } from './';
import { UseState } from '../../utils/storybook/UseState';

const SegmentStories = storiesOf('UI/Segment/SegmentAsync', module);

const AddButton = (
  <a className="gf-form-label query-part">
    <i className="fa fa-plus" />
  </a>
);

const toOption = (value: any) => ({ label: value, value: value });

const loadOptions = (options: any): Promise<Array<SelectableValue<string>>> =>
  new Promise(res => setTimeout(() => res(options), 2000));

SegmentStories.add('Array Options', () => {
  const options = ['Option1', 'Option2', 'OptionWithLooongLabel', 'Option4'].map(toOption);
  return (
    <UseState initialState={options[0] as SelectableValue<string>}>
      {(value, updateValue) => (
        <>
          <div className="gf-form-inline">
            <div className="gf-form">
              <span className="gf-form-label width-8 query-keyword">Segment Name</span>
            </div>
            <SegmentAsync
              currentOption={value}
              loadOptions={() => loadOptions(options)}
              onChange={(item: SelectableValue<any>) => {
                updateValue(item);
                action('Segment value changed')(item.value);
              }}
            />
            <SegmentAsync
              Component={AddButton}
              onChange={(item: SelectableValue<any>) => action('New value added')(item.value)}
              loadOptions={() => loadOptions(options)}
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
    <UseState initialState={groupedOptions.Prime[2] as SelectableValue<string>}>
      {(value, updateValue) => (
        <>
          <div className="gf-form-inline">
            <div className="gf-form">
              <span className="gf-form-label width-8 query-keyword">Segment Name</span>
            </div>
            <SegmentAsync
              currentOption={value}
              loadOptions={() => loadOptions(groupedOptions)}
              onChange={item => {
                updateValue(item);
                action('Segment value changed')(item.value);
              }}
            />
            <SegmentAsync
              Component={AddButton}
              onChange={item => action('New value added')(item.value)}
              loadOptions={() => loadOptions(groupedOptions)}
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
        action('Left arrow was clicked')();
        e.stopPropagation();
      }}
    />
    <span className="pointer fa fa-question-circle" onMouseEnter={() => action('onMouseEnter question mark')()} />
    <a className="value">{value}</a>
    <span
      onClick={e => {
        action('Remove was clicked')();
        e.stopPropagation();
      }}
      className="pointer fa fa-remove"
    />
    <span
      className="pointer fa fa-arrow-right"
      onClick={e => {
        action('Right arrow was clicked')();
        e.stopPropagation();
      }}
    />
  </div>
);

SegmentStories.add('Custom Label Field', () => {
  return (
    <UseState initialState={groupedOptions.Prime[2] as SelectableValue<string>}>
      {(item, updateItem) => (
        <>
          <div className="gf-form-inline">
            <div className="gf-form">
              <span className="gf-form-label width-8 query-keyword">Segment Name</span>
            </div>
            <SegmentAsync
              Component={<CustomLabelComponent {...item} />}
              loadOptions={() => loadOptions(groupedOptions)}
              onChange={(item: SelectableValue<string>) => {
                updateItem(item);
                action('Segment value changed')(item.value);
              }}
            />
            <SegmentAsync
              Component={AddButton}
              onChange={item => action('New value added')(item.value)}
              loadOptions={() => loadOptions(groupedOptions)}
            />
          </div>
        </>
      )}
    </UseState>
  );
});
