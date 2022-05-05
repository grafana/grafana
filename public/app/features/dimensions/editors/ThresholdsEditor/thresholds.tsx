import React from 'react';

import { FieldConfigEditorProps, ThresholdsConfig, ThresholdsMode, ThresholdsFieldConfigSettings } from '@grafana/data';

import { ThresholdsEditor } from './ThresholdsEditor';

export class ThresholdsValueEditor extends React.PureComponent<
  FieldConfigEditorProps<ThresholdsConfig, ThresholdsFieldConfigSettings>
> {
  constructor(props: FieldConfigEditorProps<ThresholdsConfig, ThresholdsFieldConfigSettings>) {
    super(props);
  }

  render() {
    const { onChange } = this.props;
    let value = this.props.value;
    if (!value) {
      value = {
        mode: ThresholdsMode.Percentage,

        // Must be sorted by 'value', first value is always -Infinity
        steps: [
          // anything?
        ],
      };
    }

    return <ThresholdsEditor thresholds={value} onChange={onChange} />;
  }
}
