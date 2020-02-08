import React from 'react';

import { FieldOverrideContext, FieldOverrideEditorProps, FieldConfigEditorProps } from '@grafana/data';
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
      type="number"
      step={settings.step}
      onChange={e => {
        onChange(
          item.settings.integer
            ? parseInt(e.currentTarget.value, settings.step || 10)
            : parseFloat(e.currentTarget.value)
        );
      }}
    />
  );
};

export class NumberOverrideEditor extends React.PureComponent<
  FieldOverrideEditorProps<number, NumberFieldConfigSettings>
> {
  constructor(props: FieldOverrideEditorProps<number, NumberFieldConfigSettings>) {
    super(props);
  }

  render() {
    return <div>SHOW OVERRIDE EDITOR {this.props.item.name}</div>;
  }
}
