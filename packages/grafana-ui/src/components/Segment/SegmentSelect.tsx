import React, { useRef, useEffect, useState } from 'react';
import { css, cx } from 'emotion';
import useClickAway from 'react-use/lib/useClickAway';
import { SelectableValue } from '@grafana/data';
import { Select } from '../Select/Select';
import { OptionType } from './GroupBy';

export interface Props {
  options: OptionType;
  onChange: (value: string) => void;
  onClickOutside: () => void;
  removeOptionText?: string;
}

export const SegmentSelect: React.FunctionComponent<Props> = ({
  options = [],
  onChange,
  onClickOutside,
  removeOptionText,
}) => {
  const ref = useRef(null);
  const [optionTypes, setOptionsTypes] = useState([]);

  useEffect(() => {
    const selectOptions = Array.isArray(options)
      ? options.map(v => ({ label: v, value: v }))
      : Object.entries(options).map(([key, values]: [string, string[]]) => {
          return {
            label: key,
            expanded: true,
            options: values.map(v => ({ label: v, value: v })),
          };
        });

    setOptionsTypes(
      removeOptionText ? [{ label: removeOptionText, value: removeOptionText }, ...selectOptions] : selectOptions
    );
  }, [options]);

  useClickAway(ref, () => {
    onClickOutside();
  });

  return (
    <div ref={ref}>
      <Select
        className={cx(
          css`
            width: 120px;
          `
        )}
        placeholder=""
        autoFocus={true}
        width={200}
        isOpen={true}
        onChange={(option: SelectableValue<string>) => onChange(option.value)}
        options={optionTypes}
      />
    </div>
  );
};
