import { useEffect } from 'react';
import * as React from 'react';

import { measureText } from '../../utils/measureText';

import { Input, Props as InputProps } from './Input';

export interface Props extends InputProps {
  /** Sets the min-width to a multiple of 8px. Default value is 10*/
  minWidth?: number;
  /** Sets the max-width to a multiple of 8px.*/
  maxWidth?: number;
  /** onChange function that will be run on onBlur and onKeyPress with enter*/
  onCommitChange?: (event: React.FormEvent<HTMLInputElement>) => void;
}

export const AutoSizeInput = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const {
    defaultValue = '',
    minWidth = 10,
    maxWidth,
    onCommitChange,
    onKeyDown,
    onBlur,
    value: controlledValue,
    ...restProps
  } = props;

  // Initialize internal state
  const [value, setValue] = React.useState(controlledValue ?? defaultValue);
  const [inputWidth, setInputWidth] = React.useState(minWidth);

  // Update internal state when controlled `value` prop changes
  useEffect(() => {
    if (controlledValue) {
      setValue(controlledValue);
    }
  }, [controlledValue]);

  // Update input width when `value`, `minWidth`, or `maxWidth` change
  useEffect(() => {
    setInputWidth(getWidthFor(value.toString(), minWidth, maxWidth));
  }, [value, minWidth, maxWidth]);

  return (
    <Input
      {...restProps}
      ref={ref}
      value={value.toString()}
      onChange={(event) => {
        setValue(event.currentTarget.value);
      }}
      width={inputWidth}
      onBlur={(event) => {
        if (onBlur) {
          onBlur(event);
        } else if (onCommitChange) {
          onCommitChange(event);
        }
      }}
      onKeyDown={(event) => {
        if (onKeyDown) {
          onKeyDown(event);
        } else if (event.key === 'Enter' && onCommitChange) {
          onCommitChange(event);
        }
      }}
      data-testid={'autosize-input'}
    />
  );
});

function getWidthFor(value: string, minWidth: number, maxWidth: number | undefined): number {
  if (!value) {
    return minWidth;
  }

  const extraSpace = 3;
  const realWidth = measureText(value.toString(), 14).width / 8 + extraSpace;

  if (minWidth && realWidth < minWidth) {
    return minWidth;
  }

  if (maxWidth && realWidth > maxWidth) {
    return maxWidth;
  }

  return realWidth;
}

AutoSizeInput.displayName = 'AutoSizeInput';
