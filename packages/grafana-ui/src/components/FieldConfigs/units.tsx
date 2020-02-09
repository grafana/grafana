import React from 'react';

import { FieldOverrideEditorProps, FieldConfigEditorProps } from '@grafana/data';
import { UnitPicker } from '../UnitPicker/UnitPicker';

export interface UnitFieldConfigSettings {
  // ??
}

export const UnitValueEditor: React.FC<FieldConfigEditorProps<string, UnitFieldConfigSettings>> = ({
  value,
  onChange,
}) => {
  return <UnitPicker value={value} onChange={onChange} />;
};

export class UnitsOverrideEditor extends React.PureComponent<
  FieldOverrideEditorProps<string, UnitFieldConfigSettings>
> {
  constructor(props: FieldOverrideEditorProps<string, UnitFieldConfigSettings>) {
    super(props);
  }

  render() {
    return <div>SHOW OVERRIDE EDITOR {this.props.item.name}</div>;
  }
}
