import React from 'react';

import { FieldConfigEditorProps, ValueMapping, ValueMappingFieldConfigSettings } from '@grafana/data';
import { ValueMappingsEditor } from '../../../../../public/app/features/dimensions/editors/ValueMappingsEditor/ValueMappingsEditor';

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

    return <ValueMappingsEditor value={value} onChange={onChange} />;
  }
}
