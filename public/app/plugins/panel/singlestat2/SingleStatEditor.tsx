// Libraries
import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  ThresholdsEditor,
  PanelOptionsGrid,
  ValueMappingsEditor,
  FieldDisplayOptions,
  FieldDisplayEditor,
  FieldPropertiesEditor,
  PanelOptionsGroup,
} from '@grafana/ui';
import { Threshold, ValueMapping, Field } from '@grafana/data';

import { SingleStatOptions, SparklineOptions } from './types';
import { ColoringEditor } from './ColoringEditor';
import { FontSizeEditor } from './FontSizeEditor';
import { SparklineEditor } from './SparklineEditor';

export class SingleStatEditor extends PureComponent<PanelEditorProps<SingleStatOptions>> {
  onThresholdsChanged = (thresholds: Threshold[]) => {
    const current = this.props.options.fieldOptions.defaults;
    this.onDefaultsChange({
      ...current,
      thresholds,
    });
  };

  onValueMappingsChanged = (mappings: ValueMapping[]) => {
    const current = this.props.options.fieldOptions.defaults;
    this.onDefaultsChange({
      ...current,
      mappings,
    });
  };

  onDisplayOptionsChanged = (fieldOptions: FieldDisplayOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      fieldOptions,
    });

  onSparklineChanged = (sparkline: SparklineOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      sparkline,
    });

  onDefaultsChange = (field: Partial<Field>) => {
    this.onDisplayOptionsChanged({
      ...this.props.options.fieldOptions,
      override: field,
    });
  };

  render() {
    const { options } = this.props;
    const { fieldOptions } = options;
    const { defaults } = fieldOptions;

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Display">
            <FieldDisplayEditor onChange={this.onDisplayOptionsChanged} value={fieldOptions} />
          </PanelOptionsGroup>

          <PanelOptionsGroup title="Field (default)">
            <FieldPropertiesEditor showMinMax={true} onChange={this.onDefaultsChange} value={defaults} />
          </PanelOptionsGroup>

          <FontSizeEditor options={options} onChange={this.props.onOptionsChange} />
          <ColoringEditor options={options} onChange={this.props.onOptionsChange} />
          <SparklineEditor options={options.sparkline} onChange={this.onSparklineChanged} />

          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={defaults.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={defaults.mappings} />
      </>
    );
  }
}
