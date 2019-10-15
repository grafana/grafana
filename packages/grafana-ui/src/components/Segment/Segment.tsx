import React from 'react';
import { SelectableValue } from '@grafana/data';
import { SegmentSelect, useExpandableLabel, SegmentProps } from './';

export interface SegmentSyncProps<T> extends SegmentProps<T> {
  options: Array<SelectableValue<T>>;
}

export function Segment<T>({
  options,
  value,
  onChange,
  Component,
  className,
  allowCustomValue,
  isMulti,
}: React.PropsWithChildren<SegmentSyncProps<T>>) {
  const [Label, width, expanded, setExpanded] = useExpandableLabel(false, value, className, Component);

  if (!expanded) {
    return <Label />;
  }

  return (
    <SegmentSelect
      width={width}
      value={value}
      options={options}
      onClickOutside={() => setExpanded(false)}
      allowCustomValue={allowCustomValue}
      isMulti={isMulti}
      onChange={v => {
        if (!isMulti) {
          setExpanded(false);
        }
        onChange(v);
      }}
    />
  );
}
