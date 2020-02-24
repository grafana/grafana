import React from 'react';

import {
  FieldOverrideContext,
  FieldOverrideEditorProps,
  FieldConfigEditorProps,
  ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';
import { ThresholdsEditor } from '../ThresholdsEditorNew/ThresholdsEditor';

export interface ThresholdsFieldConfigSettings {
  // Anything?
}

export const thresholdsOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  settings: ThresholdsFieldConfigSettings
) => {
  return value as ThresholdsConfig; // !!!! likely not !!!!
};

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

export class ThresholdsOverrideEditor extends React.PureComponent<
  FieldOverrideEditorProps<ThresholdsConfig, ThresholdsFieldConfigSettings>
> {
  constructor(props: FieldOverrideEditorProps<ThresholdsConfig, ThresholdsFieldConfigSettings>) {
    super(props);
  }

  render() {
    return <div>THRESHOLDS OVERRIDE EDITOR {this.props.item.name}</div>;
  }
}
