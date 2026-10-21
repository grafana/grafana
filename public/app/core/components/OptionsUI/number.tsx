import { type ChangeEvent, type FocusEvent, type KeyboardEvent, useCallback, useEffect, useState } from 'react';

import { type StandardEditorProps, type NumberFieldConfigSettings } from '@grafana/data';
import { Input } from '@grafana/ui';

import { NumberInput } from './NumberInput';

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

type VarMappingProps = Omit<StandardEditorProps<number | string, NumberFieldConfigSettings>, 'onChange'> & {
  onChange: (value?: number | string) => void;
};

/**
 * Number editor that also accepts variable expressions. It's a separate component because
 * `NumberValueEditor` is used directly by some panel editors that expect a numeric `onChange`.
 *
 * A `type="number"` input can't hold a `$`, so this is a text input. On blur or Enter, text
 * containing `$` is passed to `onChange` as a string, which callers store in `varMappings`.
 * Anything else is parsed as a number, or reverted when it isn't one.
 */
export const VarMappingNumberValueEditor = ({ value, onChange, item, id }: VarMappingProps) => {
  const { settings } = item;
  const formatted = value == null ? '' : String(value);
  const [text, setText] = useState(formatted);

  useEffect(() => {
    setText(formatted);
  }, [formatted]);

  const commit = useCallback(
    (raw: string) => {
      if (raw.includes('$')) {
        onChange(raw);
        return;
      }

      if (raw.trim() === '') {
        onChange(undefined);
        return;
      }

      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        setText(formatted);
        return;
      }

      onChange(settings?.integer ? Math.floor(parsed) : parsed);
    },
    [onChange, settings?.integer, formatted]
  );

  return (
    <Input
      type="text"
      id={id}
      value={text}
      placeholder={settings?.placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => setText(e.currentTarget.value)}
      onBlur={(e: FocusEvent<HTMLInputElement>) => commit(e.currentTarget.value)}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          commit(e.currentTarget.value);
        }
      }}
    />
  );
};
