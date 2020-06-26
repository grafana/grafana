import React from 'react';

import { FieldConfigEditorProps } from '@grafana/data';
import { TimeZonePicker } from '../TimePicker/TimeZonePicker';

export const TimeZoneValueEditor: React.FC<FieldConfigEditorProps<string, any>> = ({ value, onChange, item }) => {
  return <TimeZonePicker value={value} onChange={onChange} size="sm" includeDefault={item.settings?.includeDefault} />;
};
