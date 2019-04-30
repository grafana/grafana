// Libraries
import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  ThresholdsEditor,
  Threshold,
  PanelOptionsGrid,
  ValueMappingsEditor,
  ValueMapping,
  SingleStatValueOptions,
  SingleStatValueEditor,
} from '@grafana/ui';

import { GaugeOptionsBox } from './GaugeOptionsBox';
import { GaugeOptions } from './types';

export class GaugePanelEditor extends PureComponent<PanelEditorProps<GaugeOptions>> {
  onThresholdsChanged = (thresholds: Threshold[]) =>
    this.props.onOptionsChange({
      ...this.props.options,
      thresholds,
    });

  onValueMappingsChanged = (valueMappings: ValueMapping[]) =>
    this.props.onOptionsChange({
      ...this.props.options,
      valueMappings,
    });

  onValueOptionsChanged = (valueOptions: SingleStatValueOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      valueOptions,
    });

  render() {
    const { onOptionsChange, options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          <SingleStatValueEditor onChange={this.onValueOptionsChanged} value={options.valueOptions} />
          <GaugeOptionsBox onOptionsChange={onOptionsChange} options={options} />
          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={options.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={options.valueMappings} />
      </>
    );
  }
}
