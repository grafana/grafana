import React, { useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { Segment, SegmentAsync } from '@grafana/ui';

const toOption = (value: any) => ({ label: value, value: value });
const options = ['grupp1', 'test3test3test3test3test3test3test3test3', 'hej', 'grupp2', 'hallå', 'test3'].map(toOption);
const numberOptions = [1, 3, 5, 6].map(toOption);

export function SegmentExampleUsage() {
  const [selectedOption, setSelectedOption] = useState<SelectableValue<T>>(options[0]);
  const [selectedNumberOption, setSelectedNumberOption] = useState<SelectableValue<T>>(numberOptions[0]);

  const loadOptions = (result: any): Promise<Array<SelectableValue<string>>> =>
    new Promise(res => setTimeout(() => res(result), 2000));

  const AddButton = (
    <a className="gf-form-label query-part">
      <i className="fa fa-plus" />
    </a>
  );

  return (
    <>
      <div className="gf-form-inline">
        <div className="gf-form">
          <span className="gf-form-label width-18 query-keyword">Sync Example with string array</span>
        </div>

        <Segment currentOption={selectedOption} options={options} onChange={setSelectedOption} />
        <Segment
          Component={AddButton}
          onChange={item => console.log(`New value added ${item.value}`)}
          options={options}
        />
      </div>

      <div className="gf-form-inline">
        <div className="gf-form">
          <span className="gf-form-label width-18 query-keyword">Async Example with string array</span>
        </div>

        <SegmentAsync
          currentOption={selectedOption}
          loadOptions={() => loadOptions(options)}
          onChange={setSelectedOption}
        />
        <SegmentAsync
          Component={AddButton}
          onChange={item => console.log(`New value added ${item.value}`)}
          loadOptions={() => loadOptions(options)}
        />
      </div>

      <div className="gf-form-inline">
        <div className="gf-form">
          <span className="gf-form-label width-18 query-keyword">Async Example with number array</span>
        </div>

        <SegmentAsync
          currentOption={selectedNumberOption}
          loadOptions={() => loadOptions(numberOptions)}
          onChange={setSelectedNumberOption}
        />
        <SegmentAsync
          Component={AddButton}
          onChange={item => console.log(`New value added ${item.value}`)}
          loadOptions={() => loadOptions(numberOptions)}
        />
      </div>

      <div className="gf-form-inline">
        <div className="gf-form">
          <span className="gf-form-label width-18 query-keyword">Sync Example with custom label and callbacks</span>
        </div>

        <Segment
          Component={
            <span className=" show-function-controls">
              <div className="tight-form-func-controls">
                <span className="pointer fa fa-arrow-left" />
                <span className="pointer fa fa-question-circle" />
                <span
                  onClick={e => {
                    console.log('Remove was clicked');
                    e.stopPropagation();
                  }}
                  className="pointer fa fa-remove"
                />
                <span className="pointer fa fa-arrow-right" />
              </div>
              <a className="query-part">{selectedOption.value}</a>
            </span>
          }
          options={options}
          onChange={setSelectedOption}
        />
        <Segment
          Component={AddButton}
          onChange={item => console.log(`New value added ${item.value}`)}
          options={options}
        />
      </div>

      <div className="gf-form-inline">
        <div className="gf-form">
          <span className="gf-form-label width-18 query-keyword">Example with grouped options</span>
        </div>

        <Segment
          currentOption={selectedOption}
          options={{
            group1: options,
            group2: options,
          }}
          onChange={setSelectedOption}
        />
        <Segment
          Component={AddButton}
          onChange={item => console.log(`New value added ${item.value}`)}
          options={options}
        />
      </div>
    </>
  );
}
