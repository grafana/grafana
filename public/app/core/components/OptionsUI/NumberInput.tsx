import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { memo, useState, useRef, useEffect, useLayoutEffect, useCallback, useId, useMemo } from 'react';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FieldValidationMessage, Input, useFieldContext, useStyles2 } from '@grafana/ui';

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

function formatValue(value?: number): string {
  return value == null || Number.isNaN(value) ? '' : String(value);
}

function isInRange(n: number, min?: number, max?: number) {
  if (min != null && n < min) {
    return false;
  }
  if (max != null && n > max) {
    return false;
  }
  return true;
}

function isIncompleteNumericInput(txt: string) {
  return txt === '-' || txt === '+' || txt === '.' || txt === '-.' || txt.endsWith('.');
}

function parseInRangeValue(text: string, min?: number, max?: number): number | undefined {
  if (text === '' || isIncompleteNumericInput(text)) {
    return undefined;
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || !isInRange(parsed, min, max)) {
    return undefined;
  }

  return parsed;
}

function getRangeText(min?: number, max?: number) {
  if (min != null && max != null) {
    return t('options-ui.number-input.range-min-max', 'Range: {{min}} to {{max}}', { min, max });
  }
  if (min != null) {
    return t('options-ui.number-input.range-min', 'Minimum: {{min}}', { min });
  }
  if (max != null) {
    return t('options-ui.number-input.range-max', 'Maximum: {{max}}', { max });
  }
  return undefined;
}

/**
 * This is an Input field that will call `onChange` for blur and enter.
 * In-range values also emit after a short debounce so panel options can preview
 * while typing. Out of range values are not corrected until blur or Enter.
 *
 * @internal this is not exported to the `@grafana/ui` library, it is used
 * by options editor (number and slider), and direclty with in grafana core
 */
export const NumberInput = memo(function NumberInput({
  id,
  value,
  placeholder,
  autoFocus,
  onChange,
  min,
  max,
  step,
  width,
  fieldDisabled,
  suffix,
}: Props) {
  const [text, setText] = useState('');
  const [showCorrectionError, setShowCorrectionError] = useState(false);
  const latestPropsRef = useRef({ value, min, max, onChange });
  const rangeId = useId();
  const errorId = useId();
  const styles = useStyles2(getStyles);
  const rangeText = getRangeText(min, max);
  const fieldContext = useFieldContext();

  useEffect(() => {
    setText((current) => {
      if (current !== '' && Number.isFinite(Number(current)) && Number(current) === value) {
        return current;
      }
      return formatValue(value);
    });
  }, [value]);

  useLayoutEffect(() => {
    latestPropsRef.current = { value, min, max, onChange };
  }, [value, min, max, onChange]);

  const emitInRangeValueDebounced = useMemo(
    () =>
      debounce((txt: string) => {
        const { value, min, max, onChange } = latestPropsRef.current;
        const parsed = parseInRangeValue(txt, min, max);
        if (parsed === undefined) {
          return;
        }
        if (parsed !== value) {
          onChange(parsed);
        }
      }, 500),
    []
  );

  const commitValue = useCallback(
    (txt: string) => {
      if (txt === '') {
        setShowCorrectionError(false);
        if (value !== undefined) {
          onChange(undefined);
        }
        return;
      }

      const parsed = Number(txt);
      if (!Number.isFinite(parsed)) {
        setText(formatValue(value));
        setShowCorrectionError(false);
        return;
      }

      let next = parsed;
      let corrected = false;
      if (min != null && next < min) {
        next = min;
        corrected = true;
      } else if (max != null && next > max) {
        next = max;
        corrected = true;
      }

      setText(`${next}`);
      if (corrected) {
        setShowCorrectionError(true);
      }
      if (next !== value) {
        onChange(next);
      }
    },
    [min, max, value, onChange]
  );

  useEffect(() => {
    return () => emitInRangeValueDebounced.cancel();
  }, [emitInRangeValueDebounced]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.currentTarget.value;
      setText(next);
      setShowCorrectionError(false);

      if (parseInRangeValue(next, min, max) === undefined) {
        emitInRangeValueDebounced.cancel();
        return;
      }

      emitInRangeValueDebounced(next);
    },
    [min, max, emitInRangeValueDebounced]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      emitInRangeValueDebounced.cancel();
      commitValue(e.currentTarget.value);
    },
    [commitValue, emitInRangeValueDebounced]
  );

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        emitInRangeValueDebounced.cancel();
        commitValue(e.currentTarget.value);
      }
    },
    [commitValue, emitInRangeValueDebounced]
  );

  const localDescribedBy = showCorrectionError ? errorId : rangeText ? rangeId : undefined;
  const describedBy = [fieldContext['aria-describedby'], localDescribedBy].filter(Boolean).join(' ') || undefined;
  const errorMessage = rangeText
    ? t('options-ui.number-input.error-out-of-range', 'Out of range. {{range}}', { range: rangeText })
    : t('options-ui.number-input.error-out-of-range-generic', 'Out of range');

  return (
    <div>
      <Input
        type="number"
        id={id}
        min={min}
        max={max}
        step={step}
        autoFocus={autoFocus}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        disabled={fieldDisabled}
        width={width}
        suffix={suffix}
        invalid={showCorrectionError || fieldContext.invalid}
        aria-describedby={describedBy}
      />
      {rangeText && (
        <div id={rangeId} className={styles.rangeHint}>
          {rangeText}
        </div>
      )}
      {showCorrectionError && <FieldValidationMessage id={errorId}>{errorMessage}</FieldValidationMessage>}
    </div>
  );
});

NumberInput.displayName = 'NumberInput';

const getStyles = (theme: GrafanaTheme2) => ({
  rangeHint: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
    marginTop: theme.spacing(0.25),
  }),
});
