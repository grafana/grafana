import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  ThresholdsEditor,
  Threshold,
  PanelOptionsGrid,
  ValueMappingsEditor,
  ValueMapping,
} from '@grafana/ui';

import { ValueOptions } from 'app/plugins/panel/gauge/ValueOptions';
import { GaugeOptionsBox } from './GaugeOptionsBox';
import { GaugeOptions } from './types';

export class GaugePanelEditor extends PureComponent<PanelEditorProps<GaugeOptions>> {
  onThresholdsChanged = (thresholds: Threshold[]) =>
    this.props.onChange({
      ...this.props.options,
      thresholds,
    });

  onValueMappingsChanged = (valueMappings: ValueMapping[]) =>
    this.props.onChange({
      ...this.props.options,
      valueMappings,
    });

  render() {
    const { onChange, options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          <ValueOptions onChange={onChange} options={options} />
          <GaugeOptionsBox onChange={onChange} options={options} />
          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={options.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={options.valueMappings} />
      </>
    );
  }
}
