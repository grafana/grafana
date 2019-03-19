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

import { LHeatmapOptions } from './types';
import { SingleStatValueOptions } from '../singlestat2/types';

export class LHeatmapPanelEditor extends PureComponent<PanelEditorProps<LHeatmapOptions>> {
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
    const { options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={options.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={options.valueMappings} />
      </>
    );
  }
}
