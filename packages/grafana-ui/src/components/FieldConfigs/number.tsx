import React from 'react';

import {
  FieldOverrideContext,
  FieldOverrideEditorProps,
  FieldConfigEditorProps,
  toIntegerOrUndefined,
  toFloatOrUndefined,
} from '@grafana/data';
import Forms from '../Forms';

export interface NumberFieldConfigSettings {
  placeholder?: string;
  integer?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export const numberOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  settings: NumberFieldConfigSettings
) => {
  const v = parseFloat(`${value}`);
  if (settings.max && v > settings.max) {
    // ????
  }
  return v;
};

export const NumberValueEditor: React.FC<FieldConfigEditorProps<number, NumberFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  const { settings } = item;
  return (
    <Forms.Input
      value={isNaN(value) ? '' : value}
      min={settings.min}
      max={settings.max}
      type="number"
      step={settings.step}
      placeholder={settings.placeholder}
      onChange={e => {
        onChange(
          settings.integer ? toIntegerOrUndefined(e.currentTarget.value) : toFloatOrUndefined(e.currentTarget.value)
        );
      }}
    />
  );
};

export const NumberOverrideEditor: React.FC<FieldOverrideEditorProps<number, NumberFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  const { settings } = item;
  return (
    <Forms.Input
      value={isNaN(value) ? '' : value}
      min={settings.min}
      max={settings.max}
      type="number"
      step={settings.step}
      placeholder={settings.placeholder}
      onChange={e => {
        onChange(
          settings.integer ? toIntegerOrUndefined(e.currentTarget.value) : toFloatOrUndefined(e.currentTarget.value)
        );
      }}
    />
  );
};
