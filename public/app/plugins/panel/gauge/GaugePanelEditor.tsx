// Libraries
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
import { GaugeOptions } from './types';
import { DisplayValueEditor } from './DisplayValueEditor';
import { DisplayValueOptions } from '@grafana/ui';

export class GaugePanelEditor extends PureComponent<PanelEditorProps<GaugeOptions>> {
  onDisplayOptionsChanged = (displayOptions: DisplayValueOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      display: displayOptions,
    });

  onThresholdsChanged = (thresholds: Threshold[]) =>
    this.onDisplayOptionsChanged({
      ...this.props.options.display,
      thresholds,
    });

  onValueMappingsChanged = (valueMappings: ValueMapping[]) =>
    this.onDisplayOptionsChanged({
      ...this.props.options.display,
      mappings: valueMappings,
    });

  render() {
    const { onOptionsChange, options } = this.props;
    const { display } = options;

    return (
      <>
        <PanelOptionsGrid>
          {/* This just sets the 'stats', that should be moved to somethign more general */}
          <SingleStatValueEditor onChange={onOptionsChange} options={options} />

          <DisplayValueEditor onChange={this.onDisplayOptionsChanged} options={display} />
          <GaugeOptionsBox onOptionsChange={onOptionsChange} options={options} />
          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={display.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={display.mappings} />
      </>
    );
  }
}
