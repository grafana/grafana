import React, { useRef, useEffect, useState } from 'react';
import { css, cx } from 'emotion';
import useClickAway from 'react-use/lib/useClickAway';
import { SelectableValue } from '@grafana/data';
import { Select } from '../Select/Select';
import { OptionType } from './';

export interface Props<T> {
  options: OptionType<T> | undefined;
  onChange: (item: SelectableValue<T>) => void;
  onClickOutside: () => void;
  width: number;
  noOptionsMessage?: string;
}

export function SegmentSelect<T>({
  options = [],
  onChange,
  onClickOutside,
  width,
  noOptionsMessage = '',
}: React.PropsWithChildren<Props<T>>) {
  const ref = useRef(null);
  const [optionTypes, setOptionsTypes] = useState<Array<SelectableValue<T>>>([]);

  useEffect(() => {
    const selectOptions = Array.isArray(options)
      ? options
      : Object.entries(options).map(([key, values]: [string, Array<OptionType<T>>]) => {
          return {
            label: key,
            expanded: true,
            options: values,
          };
        });

    setOptionsTypes(selectOptions);
  }, [options]);

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
        onChange={onChange}
        options={optionTypes}
      />
    </div>
  );
}
