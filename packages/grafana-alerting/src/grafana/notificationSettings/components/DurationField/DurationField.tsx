import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { Field, Input } from '@grafana/ui';

import { isValidPromDuration } from '../../utils/promDuration';

export interface DurationFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}

/** A single Prometheus-duration input (e.g. group wait/interval, repeat interval). Validates on
 * blur rather than on every keystroke, so a duration that's mid-typing doesn't flash invalid. */
export function DurationField({ label, description, value, onChange, placeholder, disabled }: DurationFieldProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | undefined>(undefined);

  // Resyncs when the parent replaces `value` externally (e.g. clearing the contact point), and clears
  // any stale error so a reset to a valid value doesn't keep showing it.
  useEffect(() => {
    setDraft(value);
    setError(undefined);
  }, [value]);

  const commit = () => {
    if (isValidPromDuration(draft)) {
      setError(undefined);
      onChange(draft);
    } else {
      setError(
        t(
          'alerting.duration-field.invalid',
          'Invalid duration format. Use a number followed by a time unit, for example 30s or 5m.'
        )
      );
    }
  };

  return (
    <Field label={label} description={description} invalid={Boolean(error)} error={error} disabled={disabled} noMargin>
      <Input
        aria-label={label}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
      />
    </Field>
  );
}
