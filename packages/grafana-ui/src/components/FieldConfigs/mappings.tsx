import React from 'react';

import { FieldOverrideContext, FieldOverrideEditorProps, FieldConfigEditorProps, ValueMapping } from '@grafana/data';
import { ValueMappingsEditor } from '..';

export interface ValueMappingFieldConfigSettings {}

export const valueMappingsOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  settings: ValueMappingFieldConfigSettings
) => {
  return value as ValueMapping[]; // !!!! likely not !!!!
};

export class ValueMappingsValueEditor extends React.PureComponent<
  FieldConfigEditorProps<ValueMapping[], ValueMappingFieldConfigSettings>
> {
  constructor(props: FieldConfigEditorProps<ValueMapping[], ValueMappingFieldConfigSettings>) {
    super(props);
  }

  render() {
    const { onChange } = this.props;
    let value = this.props.value;
    if (!value) {
      value = [];
    }

    return <ValueMappingsEditor valueMappings={value} onChange={onChange} />;
  }
}

export class ValueMappingsOverrideEditor extends React.PureComponent<
  FieldOverrideEditorProps<ValueMapping[], ValueMappingFieldConfigSettings>
> {
  constructor(props: FieldOverrideEditorProps<ValueMapping[], ValueMappingFieldConfigSettings>) {
    super(props);
  }

  render() {
    return <div>VALUE MAPPINGS OVERRIDE EDITOR {this.props.item.name}</div>;
  }
}
