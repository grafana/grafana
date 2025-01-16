import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as React from 'react';

import { measureText } from '../../utils/measureText';

import { AutoSizeInputContext } from './AutoSizeInputContext';
import { Input, Props as InputProps } from './Input';

export interface Props extends InputProps {
  /** Sets the min-width to a multiple of 8px. Default value is 10*/
  minWidth?: number;
  /** Sets the max-width to a multiple of 8px.*/
  maxWidth?: number;
  /** onChange function that will be run on onBlur and onKeyPress with enter
   * @deprecated Use `onChange` instead and manage the value in the parent as a controlled input
   */
  onCommitChange?: (event: React.FormEvent<HTMLInputElement>) => void;

  /** @deprecated Use `value` and `onChange` instead to manage the value in the parent as a controlled input */
  defaultValue?: string | number | readonly string[];
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
  const [inputState, setInputValue] = useControlledState(controlledValue, onChange);

  // This must use ?? instead of || so the default value is not used when the value is an empty string
  // typically from the user clearing the input
  const inputValue = inputState ?? defaultValue;

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

          setInputValue(event.currentTarget.value);
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
        data-testid="autosize-input"
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

/**
 * Hook to abstract away state management for controlled and uncontrolled inputs.
 * If the initial value is not undefined, then the value will be controlled by the parent
 * for the lifetime of the component and calls to setState will be ignored.
 */
function useControlledState<T>(controlledValue: T, onChange: Function | undefined): [T, (newValue: T) => void] {
  const isControlledNow = controlledValue !== undefined && onChange !== undefined;
  const isControlledRef = useRef(isControlledNow); // set the initial value - we never change this

  const hasLoggedControlledWarning = useRef(false);
  if (isControlledNow !== isControlledRef.current && !hasLoggedControlledWarning.current) {
    console.warn(
      'An AutoSizeInput is changing from an uncontrolled to a controlled input. If you want to control the input, the empty value should be an empty string.'
    );
    hasLoggedControlledWarning.current = true;
  }

  const [internalValue, setInternalValue] = React.useState(controlledValue);

  useEffect(() => {
    if (!isControlledRef.current) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  const handleChange = useCallback((newValue: T) => {
    if (!isControlledRef.current) {
      setInternalValue(newValue);
    }
  }, []);

  const value = isControlledRef.current ? controlledValue : internalValue;

  return [value, handleChange];
}
