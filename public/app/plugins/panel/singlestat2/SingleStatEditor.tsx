// Libraries
import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  ThresholdsEditor,
  Threshold,
  PanelOptionsGrid,
  ValueMappingsEditor,
  ValueMapping,
  FieldDisplayOptions,
  FieldDisplayEditor,
  FieldPropertiesEditor,
  Field,
} from '@grafana/ui';

import { SingleStatOptions, SparklineOptions } from './types';
import { ColoringEditor } from './ColoringEditor';
import { FontSizeEditor } from './FontSizeEditor';
import { SparklineEditor } from './SparklineEditor';

export class SingleStatEditor extends PureComponent<PanelEditorProps<SingleStatOptions>> {
  onThresholdsChanged = (thresholds: Threshold[]) =>
    this.onDisplayOptionsChanged({
      ...this.props.options.fieldOptions,
      thresholds,
    });

  onValueMappingsChanged = (mappings: ValueMapping[]) =>
    this.onDisplayOptionsChanged({
      ...this.props.options.fieldOptions,
      mappings,
    });

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

    return (
      <>
        <PanelOptionsGrid>
          <FieldDisplayEditor onChange={this.onDisplayOptionsChanged} options={fieldOptions} />

          <FieldPropertiesEditor
            title="Field (default)"
            showMinMax={true}
            onChange={this.onDefaultsChange}
            options={fieldOptions.defaults}
          />

          <FontSizeEditor options={options} onChange={this.props.onOptionsChange} />
          <ColoringEditor options={options} onChange={this.props.onOptionsChange} />
          <SparklineEditor options={options.sparkline} onChange={this.onSparklineChanged} />

          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={fieldOptions.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={fieldOptions.mappings} />
      </>
    );
  }
}
