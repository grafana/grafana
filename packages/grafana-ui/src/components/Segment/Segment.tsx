import React, { HTMLProps } from 'react';
import { cx } from '@emotion/css';
import { isObject } from 'lodash';
import { SelectableValue } from '@grafana/data';
import { SegmentSelect, useExpandableLabel, SegmentProps } from './';
import { getSegmentStyles } from './styles';
import { InlineLabel } from '../Forms/InlineLabel';
import { useStyles } from '../../themes';

export interface SegmentSyncProps<T> extends SegmentProps<T>, Omit<HTMLProps<HTMLDivElement>, 'value' | 'onChange'> {
  value?: T | SelectableValue<T>;
  onChange: (item: SelectableValue<T>) => void;
  options: Array<SelectableValue<T>>;
  inputMinWidth?: number;
}

export function Segment<T>({
  options,
  value,
  onChange,
  Component,
  className,
  allowCustomValue,
  allowEmptyValue,
  placeholder,
  disabled,
  inputMinWidth,
  inputPlaceholder,
  onExpandedChange,
  autofocus = false,
  ...rest
}: React.PropsWithChildren<SegmentSyncProps<T>>) {
  const [Label, labelWidth, expanded, setExpanded] = useExpandableLabel(autofocus, onExpandedChange);
  const width = inputMinWidth ? Math.max(inputMinWidth, labelWidth) : labelWidth;
  const styles = useStyles(getSegmentStyles);

  if (!expanded) {
    const label = isObject(value) ? value.label : value;

    return (
      <Label
        disabled={disabled}
        Component={
          Component || (
            <InlineLabel
              className={cx(
                styles.segment,
                {
                  [styles.queryPlaceholder]: placeholder !== undefined && !value,
                  [styles.disabled]: disabled,
                },
                className
              )}
            >
              {label || placeholder}
            </InlineLabel>
          )
        }
      />
    );
  }

  return (
    <SegmentSelect
      {...rest}
      value={value && !isObject(value) ? { value } : value}
      placeholder={inputPlaceholder}
      options={options}
      width={width}
      onClickOutside={() => setExpanded(false)}
      allowCustomValue={allowCustomValue}
      allowEmptyValue={allowEmptyValue}
      onChange={(item) => {
        setExpanded(false);
        onChange(item);
      }}
    />
  );
}
