import React, { useEffect, useState } from 'react';
import { SelectableValue } from '@grafana/data';

import { Segment } from './Segment';
import { SegmentAsync } from './SegmentAsync';
import { SegmentAdd } from './SegmentAdd';
import _ from 'lodash';

type ObjectOption<T> = {
  [key: string]: Array<SelectableValue<T>>;
};

export type OptionType<T> = Array<SelectableValue<T>> | ObjectOption<T>;

export interface Props<T> {
  values: Array<SelectableValue<T>>;
  options: OptionType<T>;
  removeOptionText?: string;
  onChange: (items: Array<SelectableValue<T>>) => void;
  label: string;
}

export function GroupBy<T>({
  values: initialValues,
  options: initialOptions,
  removeOptionText,
  label,
  onChange,
}: React.PropsWithChildren<Props<T>>) {
  const [values, setValues] = useState<Array<SelectableValue<T>>>([]);
  const [options, setOptions] = useState<OptionType<T>>();

  useEffect(() => {
    setValues(
      initialValues.filter(({ value }) =>
        Array.isArray(initialOptions)
          ? initialOptions.some(o => o.value === value)
          : Object.entries(initialOptions).reduce(
              (acc: boolean, [, values]: [string, Array<SelectableValue<T>>]) =>
                acc || values.some(v => v.value === value),
              false
            )
      )
    );

    setOptions(initialOptions);
  }, [initialOptions, initialValues]);

  const onSegmentChange = (index: number, item: SelectableValue<T>) => {
    setValues(values.map((current, i) => (i === index ? item : current)));
    onChange(values);
  };

  const loadOptions = (): Promise<Array<SelectableValue<string>>> =>
    new Promise(res => {
      setTimeout(() => {
        console.log('loadOptions');
        res([{ label: 'test1', value: 'test1' }, { label: 'test2', value: 'test2' }]);
      }, 3000);
    });

  // const onRemove = (index: number) => {
  //   setValues(values.filter((_, i) => i !== index));
  // };

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <span className="gf-form-label width-12 query-keyword">{label}</span>
      </div>
      {values.map((value, i) => (
        <Segment
          key={i}
          currentOption={value}
          options={options}
          onChange={(item: SelectableValue<T>) => {
            onSegmentChange(i, item);
          }}
        />
      ))}
      <SegmentAdd onChange={value => setValues([...values, value])} options={options} />
      <SegmentAsync onChange={() => console.log('onchange')} getOptions={loadOptions} />
    </div>
  );
}

// export const GroupBy = component as typeof component;
