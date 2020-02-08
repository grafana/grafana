import React from 'react';

import { FieldOverrideContext, FieldOverrideEditorProps, FieldConfigEditorProps } from '@grafana/data';
import Forms from '../Forms';

export interface StringFieldConfigSettings {
  placeholder?: string;
  maxLength?: number;
}

export const stringOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  settings: StringFieldConfigSettings
) => {
  return `${value}`;
};

export const StringValueEditor: React.FC<FieldConfigEditorProps<string, StringFieldConfigSettings>> = ({
  value,
  onChange,
}) => {
  debugger;
  return <Forms.Input value={value || ''} onChange={e => onChange(e.currentTarget.value)} />;
};

export class StringOverrideEditor extends React.PureComponent<
  FieldOverrideEditorProps<string, StringFieldConfigSettings>
> {
  constructor(props: FieldOverrideEditorProps<string, StringFieldConfigSettings>) {
    super(props);
  }

  render() {
    return <div>SHOW OVERRIDE EDITOR {this.props.item.name}</div>;
  }
}
