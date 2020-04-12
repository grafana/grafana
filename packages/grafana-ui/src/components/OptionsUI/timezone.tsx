import React from 'react';

import { FieldConfigEditorProps, TimeZoneFieldConfigSettings } from '@grafana/data';
import { TimeZonePicker } from '../TimePicker/TimeZonePicker';

export const TimeZoneValueEditor: React.FC<FieldConfigEditorProps<string, TimeZoneFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  return <TimeZonePicker value={value} onChange={onChange} size="sm" includeDefault={item.settings?.includeDefault} />;
};
