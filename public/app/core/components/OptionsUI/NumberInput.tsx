import { debounce } from 'lodash';
import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as React from 'react';

import { Field, Input } from '@grafana/ui';

interface Props {
  id?: string;
  value?: number;
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (number?: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
  fieldDisabled?: boolean;
  suffix?: React.ReactNode;
}

/**
 * This is an Input field that will call `onChange` for blur and enter
 *
 * @internal this is not exported to the `@grafana/ui` library, it is used
 * by options editor (number and slider), and direclty with in grafana core
 */

export const NumberInput = memo(
  ({ id, value, placeholder, autoFocus, onChange, min, max, step, width, fieldDisabled, suffix }: Props) => {
    const [text, setText] = useState('');
    const [inputCorrected, setInputCorrected] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      setText(isNaN(value!) ? '' : `${value}`);
    }, [value]);

    const updateValue = useCallback(() => {
      const txt = inputRef.current?.value;
      let corrected = false;
      let newValue = '';
      let currentValue = txt !== '' ? Number(txt) : undefined;

      if (currentValue && !Number.isNaN(currentValue)) {
        if (min != null && currentValue < min) {
          newValue = min.toString();
          corrected = true;
        } else if (max != null && currentValue > max) {
          newValue = max.toString();
          corrected = true;
        } else {
          newValue = txt ?? '';
        }

        setText(newValue);
        setInputCorrected(corrected);
      }

      if (!Number.isNaN(currentValue) && currentValue !== value) {
        onChange(currentValue);
      }
    }, [min, max, value, onChange]);

    const updateValueDebounced = useMemo(() => debounce(updateValue, 500), [updateValue]);

    const handleChange = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setText(e.currentTarget.value);
        updateValueDebounced();
      },
      [updateValueDebounced]
    );

    const handleKeyPress = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          updateValue();
        }
      },
      [updateValue]
    );

    const renderInput = () => {
      return (
        <Input
          type="number"
          id={id}
          ref={inputRef}
          min={min}
          max={max}
          step={step}
          autoFocus={autoFocus}
          value={text}
          onChange={handleChange}
          onBlur={updateValue}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={fieldDisabled}
          width={width}
          suffix={suffix}
        />
      );
    };

    if (inputCorrected) {
      let range = '';
      if (max == null) {
        if (min != null) {
          range = `< ${min}`;
        }
      } else if (min != null) {
        range = `${min} < > ${max}`;
      } else {
        range = `> ${max}`;
      }
      return (
        <Field
          invalid={inputCorrected}
          error={`Out of range ${range}`}
          validationMessageHorizontalOverflow={true}
          style={{ direction: 'rtl' }}
        >
          {renderInput()}
        </Field>
      );
    }

    return renderInput();
  }
);

NumberInput.displayName = 'NumberInput';
