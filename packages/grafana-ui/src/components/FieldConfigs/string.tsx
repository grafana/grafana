import React from 'react';

import { FieldOverrideContext, FieldOverrideEditorProps, FieldConfigEditorProps } from '@grafana/data';

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

export class StringValueEditor extends React.PureComponent<FieldConfigEditorProps<string, StringFieldConfigSettings>> {
  constructor(props: FieldConfigEditorProps<string, StringFieldConfigSettings>) {
    super(props);
  }

  render() {
    return <div>SHOW STRING FIELD EDITOR {this.props.item.name}</div>;
  }
}

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
