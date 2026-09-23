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
 * A `varMappings`-aware sibling of `NumberValueEditor`. `NumberValueEditor` itself is a shared
 * registry entry (`FieldConfigPropertyItem.editor`/`override`) also used directly by some panel
 * editors (e.g. geomap's `StyleEditor`) with a strictly numeric `onChange` - widening its own
 * onChange to accept a string would break those unrelated callers. Instead, the defaults-editor
 * and override-row wiring render this component INSTEAD of `NumberValueEditor` for a property
 * that opts into `varMappings` expression support (see `isVarMappingEligible`), keeping
 * `NumberValueEditor` itself completely untouched.
 *
 * A native `type="number"` input cannot contain a `$`, so this renders a plain text input instead
 * and, on commit (blur/Enter, mirroring `ThresholdsEditor`'s pattern), decides whether the typed
 * text is a variable expression or a plain number:
 *
 * - Text containing `$` is surfaced up via `onChange` as a raw string instead of a parsed number
 *   - the caller routes it into the `varMappings` side-channel and leaves the property's own
 *     stored value untouched as the numeric fallback.
 * - Anything else behaves exactly as `NumberInput`: parsed to a number (or reverted to the last
 *   known value if not a valid number), which also clears any existing expression for this
 *   property (handled by the caller once it sees a non-string value come through `onChange`).
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
        setText(formatted); // not a valid number either - revert, same as NumberInput today
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
