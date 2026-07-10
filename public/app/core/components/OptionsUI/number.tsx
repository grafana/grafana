import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';

import { type StandardEditorProps, type NumberFieldConfigSettings } from '@grafana/data';
import { Input } from '@grafana/ui';

import { NumberInput } from './NumberInput';

type Props = StandardEditorProps<number | string, NumberFieldConfigSettings>;

export const NumberValueEditor = ({ value, onChange, item, id }: Props) => {
  const { settings } = item;

  const onValueChange = useCallback(
    (value: number | undefined) => {
      onChange(settings?.integer && value !== undefined ? Math.floor(value) : value);
    },
    [onChange, settings?.integer]
  );

  if (settings?.allowVariables) {
    return (
      <NumberOrVariableInput
        id={id}
        value={value}
        placeholder={settings?.placeholder}
        integer={settings?.integer}
        onChange={onChange}
      />
    );
  }

  return (
    <NumberInput
      id={id}
      value={typeof value === 'number' ? value : undefined}
      min={settings?.min}
      max={settings?.max}
      step={settings?.step}
      placeholder={settings?.placeholder}
      onChange={onValueChange}
    />
  );
};

interface NumberOrVariableInputProps {
  id?: string;
  value?: number | string;
  placeholder?: string;
  integer?: boolean;
  onChange: (value?: number | string) => void;
}

/**
 * Text entry that accepts either a number or a string containing a variable
 * expression (discriminated by `$`). Commits on blur and Enter.
 */
const NumberOrVariableInput = ({ id, value, placeholder, integer, onChange }: NumberOrVariableInputProps) => {
  const [text, setText] = useState(value == null ? '' : String(value));

  useEffect(() => {
    setText(value == null ? '' : String(value));
  }, [value]);

  const commit = useCallback(() => {
    const trimmed = text.trim();

    if (trimmed === '') {
      if (value != null) {
        onChange(undefined);
      }
      return;
    }

    // Variable expressions are stored as-is and resolved at render time
    if (trimmed.includes('$')) {
      if (trimmed !== value) {
        onChange(trimmed);
      }
      return;
    }

    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
      const next = integer ? Math.floor(num) : num;
      if (next !== value) {
        onChange(next);
      }
    }
  }, [text, value, integer, onChange]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit();
      }
    },
    [commit]
  );

  return (
    <Input
      type="text"
      id={id}
      value={text}
      placeholder={placeholder}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
};
