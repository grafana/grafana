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

import { SingleStatOptions, SparklineOptions } from './types';
import { ColoringEditor } from './ColoringEditor';
import { FontSizeEditor } from './FontSizeEditor';
import { SparklineEditor } from './SparklineEditor';

export class SingleStatEditor extends PureComponent<PanelEditorProps<SingleStatOptions>> {
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

  onSparklineChanged = (sparkline: SparklineOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      sparkline,
    });

  render() {
    const { options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          <SingleStatValueEditor onChange={this.onValueOptionsChanged} options={options.valueOptions} />
          <FontSizeEditor options={options} onChange={this.props.onOptionsChange} />
          <ColoringEditor options={options} onChange={this.props.onOptionsChange} />
          <SparklineEditor options={options.sparkline} onChange={this.onSparklineChanged} />

          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={options.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={options.valueMappings} />
      </>
    );
  }
}
