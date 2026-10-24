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
  disabled?: boolean;
}

/** A single Prometheus-duration input (e.g. group wait/interval, repeat interval). The error only
 * appears once the field has been left, so a duration that's mid-typing doesn't flash invalid. */
export function DurationField({ label, description, value, onChange, placeholder, disabled }: DurationFieldProps) {
  const [touched, setTouched] = useState(false);

  const error =
    touched && !isValidPromDuration(value)
      ? t(
          'alerting.duration-field.invalid',
          'Invalid duration format. Use a number followed by a time unit, for example 30s or 5m.'
        )
      : undefined;

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
