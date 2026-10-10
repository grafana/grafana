import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Field, Input } from '@grafana/ui';

import { isValidPromDuration } from '../../utils/promDuration';

export interface DurationFieldProps {
  label: string;
  description?: string;
  value: string;
  /** Called on every edit, valid or not, so the parent always holds what the user sees. Use
   * `isValidPromDuration` to block submitting an invalid value. */
  onChange: (value: string) => void;
  placeholder: string;
  /** Set to false for durations the backend requires to be greater than zero. Defaults to true. */
  allowZero?: boolean;
  /** Set to false for durations whose API schema has no `ms` unit. Defaults to true. */
  allowMilliseconds?: boolean;
  disabled?: boolean;
}

/** A single Prometheus-duration input (e.g. group wait/interval, repeat interval). The error only
 * appears once the field has been left, so a duration that's mid-typing doesn't flash invalid. */
export function DurationField({
  label,
  description,
  value,
  onChange,
  placeholder,
  allowZero = true,
  allowMilliseconds = true,
  disabled,
}: DurationFieldProps) {
  const [touched, setTouched] = useState(false);

  const error = touched ? getError(value, { allowZero, allowMilliseconds }) : undefined;

  return (
    <Field label={label} description={description} invalid={Boolean(error)} error={error} disabled={disabled} noMargin>
      <Input
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.currentTarget.value)}
        onBlur={() => setTouched(true)}
      />
    </Field>
  );
}

function getError(value: string, options: { allowZero: boolean; allowMilliseconds: boolean }): string | undefined {
  if (!isValidPromDuration(value, { allowMilliseconds: options.allowMilliseconds })) {
    return t(
      'alerting.duration-field.invalid',
      'Invalid duration format. Use a number followed by a time unit, for example 30s or 5m.'
    );
  }
  if (!isValidPromDuration(value, options)) {
    return t('alerting.duration-field.zero', 'Duration must be greater than zero.');
  }
  return undefined;
}
