import React, { useRef } from 'react';
import { css, cx } from 'emotion';
import useClickAway from 'react-use/lib/useClickAway';
import { SelectableValue } from '@grafana/data';
import { Select } from '../Select/Select';

export interface Props<T> {
  options: Array<SelectableValue<T>>;
  onChange: (value: T) => void;
  onClickOutside: () => void;
  width: number;
  noOptionsMessage?: string;
  allowCustomValue?: boolean;
}

export function SegmentSelect<T>({
  options = [],
  onChange,
  onClickOutside,
  width,
  noOptionsMessage = '',
  allowCustomValue = false,
}: React.PropsWithChildren<Props<T>>) {
  const ref = useRef(null);

  useClickAway(ref, () => {
    onClickOutside();
  });

  return (
    <div ref={ref}>
      <Select
        className={cx(
          css`
            width: ${width > 120 ? width : 120}px;
          `
        )}
        noOptionsMessage={() => noOptionsMessage}
        placeholder=""
        autoFocus={true}
        isOpen={true}
        onChange={({ value }) => onChange(value!)}
        options={options}
        allowCustomValue={allowCustomValue}
      />
    </div>
  );
}
