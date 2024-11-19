import { useMemo, useRef } from 'react';
import * as React from 'react';

import { measureText } from '../../utils/measureText';

import { AutoSizeInputContext } from './AutoSizeInputContext';
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
    onChange,
    onKeyDown,
    onBlur,
    value: controlledValue,
    placeholder,
    ...restProps
  } = props;
  const isControlledRef = useRef(controlledValue !== undefined);

  // Initialize internal state
  const [internalValue, setInternalValue] = React.useState(controlledValue);

  const inputValue = (isControlledRef.current ? controlledValue : internalValue) || defaultValue;

  // Update input width when `value`, `minWidth`, or `maxWidth` change
  const inputWidth = useMemo(() => {
    const displayValue = inputValue || placeholder || '';
    const valueString = typeof displayValue === 'string' ? displayValue : displayValue.toString();

    return getWidthFor(valueString, minWidth, maxWidth);
  }, [placeholder, inputValue, minWidth, maxWidth]);

  return (
    <AutoSizeInputContext.Provider value={true}>
      <Input
        {...restProps}
        placeholder={placeholder}
        ref={ref}
        value={inputValue.toString()}
        onChange={(event) => {
          if (onChange) {
            onChange(event);
          }
          if (isControlledRef.current) {
            setInternalValue(event.currentTarget.value);
          }
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
    </AutoSizeInputContext.Provider>
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
