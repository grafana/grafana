import React from 'react';
import { cx } from 'emotion';
import { OptionType, SegmentSelect, useExpandableLabel, SegmentProps } from './';

export interface SegmentSyncProps<T> extends SegmentProps<T> {
  options: OptionType<T>;
}

export function Segment<T>({
  options,
  value,
  onChange,
  Component,
  className,
}: React.PropsWithChildren<SegmentSyncProps<T>>) {
  const [Label, width, expanded, setExpanded] = useExpandableLabel(false);

  if (!expanded) {
    return <Label Component={Component || <a className={cx('gf-form-label', 'query-part', className)}>{value}</a>} />;
  }

  return (
    <SegmentSelect
      width={width}
      options={options}
      onClickOutside={() => setExpanded(false)}
      onChange={value => {
        setExpanded(false);
        onChange(value);
      }}
    />
  );
}
