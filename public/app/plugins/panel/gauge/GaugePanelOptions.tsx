// Libraries
import React, { PureComponent } from 'react';

// Components
import { ValueOptions } from 'app/plugins/panel/gauge/ValueOptions';
import { GaugeOptionsEditor } from './GaugeOptionsEditor';
import { ThresholdsEditor, ValueMappingsEditor } from '@grafana/ui';

// Types
import { PanelOptionsProps, Threshold, PanelOptionsGrid, ValueMapping } from '@grafana/ui';
import { GaugeOptions } from './types';

export class GaugePanelOptions extends PureComponent<PanelOptionsProps<GaugeOptions>> {
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
          <GaugeOptionsEditor onChange={onChange} options={options} />
          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={options.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={options.valueMappings} />
      </>
    );
  }
}
