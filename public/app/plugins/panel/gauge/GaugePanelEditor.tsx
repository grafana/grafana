import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  ThresholdsEditor,
  Threshold,
  PanelOptionsGrid,
  ValueMappingsEditor,
  ValueMapping,
} from '@grafana/ui';

import { SingleStatValueEditor } from 'app/plugins/panel/gauge/SingleStatValueEditor';
import { GaugeOptionsBox } from './GaugeOptionsBox';
import { GaugeOptions, SingleStatValueOptions } from './types';
import { DisplayValueEditor } from './DisplayValueEditor';
import { DisplayValueOptions } from '@grafana/ui/src/utils/valueProcessor';

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

  onDisplayOptionsChanged = (displayOptions: DisplayValueOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      displayOptions,
    });

  render() {
    const { onOptionsChange, options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          {/* This just sets the 'stats', that should be moved to somethign more general */}
          <SingleStatValueEditor onChange={onOptionsChange} options={options} />

          <DisplayValueEditor onChange={this.onDisplayOptionsChanged} options={options.displayOptions} />
          <GaugeOptionsBox onOptionsChange={onOptionsChange} options={options} />
          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={options.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={options.valueMappings} />
      </>
    );
  }
}
