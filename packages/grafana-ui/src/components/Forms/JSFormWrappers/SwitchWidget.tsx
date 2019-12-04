import React from 'react';
import { Switch } from '../Switch';
import { WidgetProps } from 'react-jsonschema-form';

export const SwitchWidget: React.FC<WidgetProps> = ({ label, value, id, onChange, options }) => {
  return <Switch checked={!!value} onChange={(_, checked) => onChange(checked)} {...options} />;
};
