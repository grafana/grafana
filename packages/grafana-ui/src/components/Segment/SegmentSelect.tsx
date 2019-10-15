import React, { useRef } from 'react';
import { css, cx } from 'emotion';
import useClickAway from 'react-use/lib/useClickAway';
import { SelectableValue } from '@grafana/data';
import { Select } from '../Select/Select';

export interface Props<T> {
  options: Array<SelectableValue<T>>;
  value?: T | T[];
  onChange: (value: T | T[]) => void;
  onClickOutside: () => void;
  width: number;
  noOptionsMessage?: string;
  allowCustomValue?: boolean;
  isMulti?: boolean;
}

export function SegmentSelect<T>({
  options = [],
  noOptionsMessage = '',
  allowCustomValue = false,
  isMulti = false,
  value,
  onChange,
  onClickOutside,
  width,
}: React.PropsWithChildren<Props<T>>) {
  const ref = useRef(null);

  useClickAway(ref, () => {
    onClickOutside();
  });

  function toSelectableValue(v: any): SelectableValue<T> {
    return { label: v, value: v };
  }

  return (
    <div ref={ref}>
      <Select
        className={cx(
          css`
            min-width: ${width > 120 ? width : 120}px;
          `
        )}
        isMulti={isMulti}
        noOptionsMessage={() => noOptionsMessage}
        placeholder=""
        autoFocus={true}
        isOpen={true}
        onChange={v => {
          let res: T | T[];
          if (isMulti) {
            if (v.length) {
              res = v.map(({ value }: SelectableValue<T>) => value);
            } else if (options.length) {
              res = options[0].value!; //Select first option if all were deselected
            } else {
              res = [];
            }
          } else {
            res = (v as SelectableValue<T>).value!;
          }
          onChange(res);
        }}
        value={value ? (Array.isArray(value) ? value.map(toSelectableValue) : toSelectableValue(value)) : undefined}
        options={options}
        allowCustomValue={allowCustomValue}
      />
    </div>
  );
}
