import React from 'react';

import {
  FieldOverrideContext,
  FieldOverrideEditorProps,
  FieldConfigEditorProps,
  ThresholdsConfig,
} from '@grafana/data';
import { ThresholdsEditor } from '../ThresholdsEditor/ThresholdsEditor';

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
    const { theme, value, onChange } = this.props;
    return <ThresholdsEditor showAlphaUI={true} thresholds={value} onChange={onChange} theme={theme} />;
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
