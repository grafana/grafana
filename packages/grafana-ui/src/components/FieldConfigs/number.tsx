import React from 'react';

import { FieldOverrideContext, FieldOverrideEditorProps, FieldConfigEditorProps } from '@grafana/data';

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

export class NumberValueEditor extends React.PureComponent<FieldConfigEditorProps<number, NumberFieldConfigSettings>> {
  constructor(props: FieldConfigEditorProps<number, NumberFieldConfigSettings>) {
    super(props);
  }

  render() {
    return <div>SHOW number FIELD EDITOR {this.props.item.name}</div>;
  }
}

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
