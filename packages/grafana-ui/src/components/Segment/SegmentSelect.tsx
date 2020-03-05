import React, { useRef } from 'react';
import { css, cx } from 'emotion';
import useClickAway from 'react-use/lib/useClickAway';
import { SelectableValue } from '@grafana/data';
import { Select } from '../Select/Select';

export interface Props<T> {
  value?: SelectableValue<T>;
  options: Array<SelectableValue<T>>;
  onChange: (item: SelectableValue<T>) => void;
  onClickOutside: () => void;
  width: number;
  noOptionsMessage?: string;
  allowCustomValue?: boolean;
}

export function SegmentSelect<T>({
  value,
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
        placeholder=""
        autoFocus={true}
        isOpen={true}
        onChange={onChange}
        options={options}
        value={value}
        allowCustomValue={allowCustomValue}
      />
    </div>
  );
}
