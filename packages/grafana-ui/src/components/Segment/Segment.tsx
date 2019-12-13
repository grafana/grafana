import React from 'react';
import { cx } from 'emotion';
import _ from 'lodash';
import { SelectableValue } from '@grafana/data';
import { SegmentSelect, useExpandableLabel, SegmentProps } from './';

export interface SegmentSyncProps<T> extends SegmentProps<T> {
  value?: T | SelectableValue<T>;
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
  placeholder,
}: React.PropsWithChildren<SegmentSyncProps<T>>) {
  const [Label, width, expanded, setExpanded] = useExpandableLabel(false);

  if (!expanded) {
    const label = _.isObject(value) ? value.label : value;
    return (
      <Label
        Component={
          Component || (
            <a className={cx('gf-form-label', 'query-part', !value && placeholder && 'query-placeholder', className)}>
              {label || placeholder}
            </a>
          )
        }
      />
    );
  }

  return (
    <SegmentSelect
      value={value && !_.isObject(value) ? { value } : value}
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
