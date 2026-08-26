import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { memo, useState, useRef, useEffect, useCallback, useMemo, useId } from 'react';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, Input, useStyles2 } from '@grafana/ui';

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

function isInRange(n: number, min?: number, max?: number) {
  if (min != null && n < min) {
    return false;
  }
  if (max != null && n > max) {
    return false;
  }
  return true;
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

export const NumberInput = memo(
  ({ id, value, placeholder, autoFocus, onChange, min, max, step, width, fieldDisabled, suffix }: Props) => {
    const [text, setText] = useState('');
    const [inputCorrected, setInputCorrected] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const rangeId = useId();
    const styles = useStyles2(getStyles);
    const rangeText = getRangeText(min, max);

    useEffect(() => {
      setText(isNaN(value!) ? '' : `${value}`);
    }, [value]);

    const commitValue = useCallback((raw?: string) => {
      const txt = raw ?? inputRef.current?.value ?? '';
      if (txt === '') {
        setInputCorrected(false);
        if (value !== undefined) {
          onChange(undefined);
        }
        return;
      }

      const parsed = Number(txt);
      if (!Number.isFinite(parsed)) {
        setText(value == null || Number.isNaN(value) ? '' : `${value}`);
        setInputCorrected(false);
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
      setInputCorrected(corrected);
      if (next !== value) {
        onChange(next);
      }
    }, [min, max, value, onChange]);

    const commitValueDebounced = useMemo(() => debounce(commitValue, 500), [commitValue]);

    useEffect(() => {
      return () => {
        commitValueDebounced.cancel();
      };
    }, [commitValueDebounced]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.currentTarget.value;
        setText(next);
        setInputCorrected(false);

        if (next === '') {
          commitValueDebounced.cancel();
          return;
        }

        const parsed = Number(next);
        if (!Number.isFinite(parsed) || !isInRange(parsed, min, max)) {
          commitValueDebounced.cancel();
          return;
        }

        commitValueDebounced();
      },
      [commitValueDebounced, min, max]
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        commitValueDebounced.cancel();
        commitValue(e.currentTarget.value);
      },
      [commitValue, commitValueDebounced]
    );

    const handleKeyPress = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          commitValueDebounced.cancel();
          commitValue(e.currentTarget.value);
        }
      },
      [commitValue, commitValueDebounced]
    );

    const describedBy = rangeText ? rangeId : undefined;
    const errorMessage = rangeText
      ? t('options-ui.number-input.error-out-of-range', 'Out of range. {{range}}', { range: rangeText })
      : t('options-ui.number-input.error-out-of-range-generic', 'Out of range');

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
          onBlur={handleBlur}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={fieldDisabled}
          width={width}
          suffix={suffix}
          aria-describedby={inputCorrected ? undefined : describedBy}
        />
      );
    };

    return (
      <div>
        <Field
          invalid={inputCorrected}
          error={inputCorrected ? errorMessage : undefined}
          validationMessageHorizontalOverflow={true}
          htmlFor={id}
          noMargin
          style={inputCorrected ? { direction: 'rtl' } : undefined}
        >
          {renderInput()}
        </Field>
        {rangeText && (
          <div id={rangeId} className={styles.rangeHint}>
            {rangeText}
          </div>
        )}
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';

const getStyles = (theme: GrafanaTheme2) => ({
  rangeHint: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
    marginTop: theme.spacing(0.25),
  }),
});
