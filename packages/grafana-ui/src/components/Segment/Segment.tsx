import React, { HTMLProps } from 'react';
import { cx } from 'emotion';
import _ from 'lodash';
import { SelectableValue } from '@grafana/data';
import { SegmentSelect, useExpandableLabel, SegmentProps } from './';
import { getStyles } from './styles';

export interface SegmentSyncProps<T> extends SegmentProps<T>, Omit<HTMLProps<HTMLDivElement>, 'value' | 'onChange'> {
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
  disabled,
  ...rest
}: React.PropsWithChildren<SegmentSyncProps<T>>) {
  const [Label, width, expanded, setExpanded] = useExpandableLabel(false);

  if (!expanded) {
    const label = _.isObject(value) ? value.label : value;
    return (
      <Label
        disabled={disabled}
        Component={
          Component || (
            <a
              className={cx(
                'gf-form-label',
                'query-part',
                !value && placeholder && 'query-placeholder',
                getStyles<T>({ disabled: disabled }).link,
                className
              )}
            >
              {label || placeholder}
            </a>
          )
        }
      />
    );
  }

  return (
    <SegmentSelect
      {...rest}
      value={value && !_.isObject(value) ? { value } : value}
      options={options}
      width={width}
      onClickOutside={() => setExpanded(false)}
      allowCustomValue={allowCustomValue}
      onChange={(item) => {
        setExpanded(false);
        onChange(item);
      }}
    />
  );
}
