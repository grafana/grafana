import { type ChangeEvent } from 'react';

import { ColorPickerInput, Field, Input } from '@grafana/ui';

import { type ThemeFieldDef } from '../../state/themeStudioModel';

interface Props {
  field: ThemeFieldDef;
  value: string | number | undefined;
  onChange: (path: string, value: string | number | undefined) => void;
}

export function ThemeStudioField({ field, value, onChange }: Props) {
  const handleNumber = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.currentTarget.value;
    onChange(field.path, raw === '' ? undefined : Number(raw));
  };

  const handleText = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(field.path, event.currentTarget.value);
  };

  return (
    <Field noMargin label={field.label}>
      {field.kind === 'color' ? (
        <ColorPickerInput
          value={typeof value === 'string' ? value : ''}
          onChange={(color) => onChange(field.path, color)}
          returnColorAs="hex"
        />
      ) : field.kind === 'number' ? (
        <Input type="number" value={value ?? ''} onChange={handleNumber} />
      ) : (
        <Input value={typeof value === 'string' ? value : ''} onChange={handleText} />
      )}
    </Field>
  );
}
