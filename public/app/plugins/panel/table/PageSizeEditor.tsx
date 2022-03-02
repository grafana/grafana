import { StandardEditorProps } from '@grafana/data';
import { NumberValueEditor } from '@grafana/ui';
import React from 'react';

export function PageSizeEditor({ onChange, value, id, context }: StandardEditorProps<number>) {
  const changeValue = (newValue: number | undefined) => {
    if (newValue) {
      context.options.footer.show = false;
    }
    onChange(newValue);
  };

  return (
    <NumberValueEditor
      context={context}
      id={id}
      value={value}
      onChange={changeValue}
      item={{ settings: { min: 1, integer: true } } as any}
    />
  );
}
