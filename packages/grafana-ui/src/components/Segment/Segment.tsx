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
    const styles = getStyles();

    return (
      <Label
        disabled={disabled}
        Component={
          Component || (
             <InlineLabel
              className={cx(
                styles.clickable,
                {
                  ['query-placeholder']: placeholder !== undefined && !value,
                  [styles.disabled]: disabled,
                },
                className
              )}
            >
              {label || placeholder}
            </InlineLabel>
              {label || placeholder}
            </span>
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
