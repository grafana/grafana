import React from 'react';
import { cx } from 'emotion';
import { SelectableValue } from '@grafana/data';
import { SegmentSelect, useExpandableLabel, SegmentProps } from './';

export interface SegmentSyncProps<T> extends SegmentProps<T> {
  value?: SelectableValue<T>;
  onChange: (item: SelectableValue<T>) => void;
  options: Array<SelectableValue<T>>;
}

export function Segment<T>({
  options,
  value,
  onChange,
  Component,
  className,
  allowCustomValue,
}: React.PropsWithChildren<SegmentSyncProps<T>>) {
  const [Label, width, expanded, setExpanded] = useExpandableLabel(false);

  if (!expanded) {
    return (
      <Label
        Component={Component || <a className={cx('gf-form-label', 'query-part', className)}>{value && value.label}</a>}
      />
    );
  }

  return (
    <SegmentSelect
      value={value}
      options={options}
      width={width}
      onClickOutside={() => setExpanded(false)}
      allowCustomValue={allowCustomValue}
      onChange={item => {
        setExpanded(false);
        onChange(item);
      }}
    />
  );
}
