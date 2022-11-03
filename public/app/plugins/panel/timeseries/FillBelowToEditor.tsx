import React, { useMemo } from 'react';

import { FieldOverrideEditorProps, FieldType, getFieldDisplayName, SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

export const FillBellowToEditor: React.FC<
  FieldOverrideEditorProps<{ frameIndex: string; fieldIndex: string }, any>
> = ({ value, context, onChange }) => {
  const names = useMemo(() => {
    const names: Array<SelectableValue<{ frameIndex: string; fieldIndex: string }>> = [];
    if (context.data.length) {
      for (const [frameIndex, frame] of Object.entries(context.data)) {
        for (const [fieldIndex, field] of Object.entries(frame.fields)) {
          if (field.type === FieldType.number) {
            const label = getFieldDisplayName(field, frame, context.data);
            names.push({
              label: label,
              value: { frameIndex, fieldIndex },
            });
          }
        }
      }
    }
    return names;
  }, [context]);

  const current = useMemo(() => {
    const found = names.find(
      (v) => v.value?.frameIndex === value.frameIndex && v.value?.fieldIndex === value.fieldIndex
    );
    if (found) {
      return found;
    }
    // if (value) {
    //   return {
    //     label: 'Field',
    //     value,
    //   };
    // }
    return undefined;
  }, [names, value]);

  return (
    <Select
      options={names}
      value={current}
      onChange={(v) => {
        onChange(v.value);
      }}
    />
  );
};
