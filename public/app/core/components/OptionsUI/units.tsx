import React from 'react';

import { FieldConfigEditorProps, UnitFieldConfigSettings } from '@grafana/data';
import { IconButton, UnitPicker } from '@grafana/ui';

type Props = FieldConfigEditorProps<string, UnitFieldConfigSettings>;

export function UnitValueEditor({ value, onChange, item }: Props) {
  if (item?.settings?.isClearable && value != null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <UnitPicker value={value} onChange={onChange} />
        <IconButton name="times" onClick={() => onChange(undefined)} style={{ marginLeft: '8px' }} />
      </div>
    );
  }
  return <UnitPicker value={value} onChange={onChange} />;
}
