import { css } from '@emotion/css';
import { type ChangeEvent, type FocusEvent, type KeyboardEvent, useCallback, useId, useState } from 'react';

import { type GrafanaTheme2, type StandardEditorProps, type NumberFieldConfigSettings } from '@grafana/data';
import { hasVarMappingVariableReference, isInVarMappingRange } from '@grafana/data/internal';
import { FieldValidationMessage, Input, useFieldContext, useStyles2 } from '@grafana/ui';

import { getOutOfRangeText, getRangeText, NumberInput } from './NumberInput';

type Props = StandardEditorProps<number, NumberFieldConfigSettings>;

export const NumberValueEditor = ({ value, onChange, item, id }: Props) => {
  const { settings } = item;

  const onValueChange = useCallback(
    (value: number | undefined) => {
      onChange(settings?.integer && value !== undefined ? Math.floor(value) : value);
    },
    [onChange, settings?.integer]
  );

  return (
    <NumberInput
      id={id}
      value={value}
      min={settings?.min}
      max={settings?.max}
      step={settings?.step}
      placeholder={settings?.placeholder}
      onChange={onValueChange}
    />
  );
};

type VarMappingProps = Omit<StandardEditorProps<number | string, NumberFieldConfigSettings>, 'value' | 'onChange'> & {
  value?: number | string;
  onChange: (value?: number | string) => void;
};

/**
 * Number editor that also accepts variable expressions. It's a separate component because
 * `NumberValueEditor` is used directly by some panel editors that expect a numeric `onChange`.
 *
 * A `type="number"` input can't hold a `$`, so this is a text input. On blur or Enter, text with a
 * variable reference is passed to `onChange` as a string, which callers store in `varMappings`. A
 * `$` without a variable isn't stored. Anything else is parsed as a number in the settings' range,
 * or reverted when it isn't one.
 */
export const VarMappingNumberValueEditor = ({ value, onChange, item, id }: VarMappingProps) => {
  const { settings } = item;
  const formatted = value == null ? '' : String(value);
  const [text, setText] = useState(formatted);
  const [rangeError, setRangeError] = useState<string>();
  // The last text passed to onChange, so the blur after Enter doesn't commit it again
  const [committed, setCommitted] = useState(formatted);
  const [prevFormatted, setPrevFormatted] = useState(formatted);
  const rangeId = useId();
  const errorId = useId();
  const rangeText = getRangeText(settings?.min, settings?.max);
  const fieldContext = useFieldContext();
  const styles = useStyles2(getStyles);

  if (formatted !== prevFormatted) {
    setPrevFormatted(formatted);
    setCommitted(formatted);
    setText(formatted);
    setRangeError(undefined);
  }

  const commit = useCallback(
    (raw: string) => {
      setRangeError(undefined);
      if (raw === committed) {
        return;
      }

      if (hasVarMappingVariableReference(raw)) {
        setCommitted(raw);
        onChange(raw);
        return;
      }
      // Not an expression yet, so it's kept as typed until a variable name follows
      if (raw.includes('$')) {
        return;
      }

      if (raw.trim() === '') {
        setCommitted(raw);
        onChange(undefined);
        return;
      }

      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        setText(committed);
        return;
      }

      const num = settings?.integer ? Math.floor(parsed) : parsed;
      if (!isInVarMappingRange(num, settings)) {
        setRangeError(getOutOfRangeText(settings?.min, settings?.max));
        return;
      }

      // Show what's stored, which differs from the text when it was floored
      const numText = String(num);
      setText(numText);
      setCommitted(numText);
      onChange(num);
    },
    [committed, onChange, settings]
  );

  // Same as NumberInput: the error replaces the range hint while it's shown
  const localDescribedBy = rangeError ? errorId : rangeText ? rangeId : undefined;
  const describedBy = [fieldContext['aria-describedby'], localDescribedBy].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <Input
        type="text"
        id={id}
        value={text}
        placeholder={settings?.placeholder}
        invalid={rangeError !== undefined || fieldContext.invalid}
        aria-describedby={describedBy}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setText(e.currentTarget.value);
          setRangeError(undefined);
        }}
        onBlur={(e: FocusEvent<HTMLInputElement>) => commit(e.currentTarget.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') {
            commit(e.currentTarget.value);
          }
        }}
      />
      {rangeText && (
        <div id={rangeId} className={styles.rangeHint}>
          {rangeText}
        </div>
      )}
      {rangeError && <FieldValidationMessage id={errorId}>{rangeError}</FieldValidationMessage>}
    </div>
  );
};

// Matches NumberInput's range hint
const getStyles = (theme: GrafanaTheme2) => ({
  rangeHint: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
    marginTop: theme.spacing(0.25),
  }),
});
