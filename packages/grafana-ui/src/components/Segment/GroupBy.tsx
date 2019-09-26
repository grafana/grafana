import React, { useEffect, useState, FunctionComponent } from 'react';

import { Segment } from './Segment';
import { SegmentAdd } from './SegmentAdd';
import _ from 'lodash';

type ObjectOption = {
  [key: string]: string[];
};

export type OptionType = string[] | ObjectOption;

export interface FilterGroupProps {
  values: string[];
  options: OptionType;
  removeOptionText?: string;
  onChange: (values: string[]) => void;
}

export const GroupBy: FunctionComponent<FilterGroupProps> = ({
  values: initialValues,
  options: initialOptions,
  removeOptionText = '- remove group by -',
  onChange,
}) => {
  const [values, setValues] = useState<string[]>([]);
  const [options, setOptions] = useState<OptionType>();

  useEffect(() => {
    setValues(
      initialValues.filter(iv =>
        Array.isArray(initialOptions)
          ? initialOptions.includes(iv)
          : Object.entries(initialOptions).reduce(
              (acc, [, values]: [string, string[]]) => (acc ? acc : values.includes(iv)),
              false
            )
      )
    );
    setOptions(initialOptions);
  }, [initialOptions, initialValues]);

  const onRemove = (index: number) => {
    setValues(values.filter((_, i) => i !== index));
  };

  const onSegmentChange = (index: number, value: string) => {
    setValues(values.map((v, i) => (i === index ? value : v)));
    onChange(values);
  };

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <span className="gf-form-label width-9 query-keyword">Group By</span>
      </div>
      {values.map((value, i) => (
        <Segment
          key={i}
          value={value}
          removeOptionText={removeOptionText}
          options={options}
          onRemove={() => onRemove(i)}
          onChange={(value: string) => onSegmentChange(i, value)}
        />
      ))}
      <SegmentAdd onChange={value => setValues([...values, value])} options={options} />
    </div>
  );
};
