// Libraries
import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  ThresholdsEditor,
  PanelOptionsGrid,
  ValueMappingsEditor,
  ValueMapping,
  FieldDisplayOptions,
  FieldDisplayEditor,
  FieldPropertiesEditor,
  Field,
  Scale,
  PanelOptionsGroup,
} from '@grafana/ui';

import { SingleStatOptions, SparklineOptions } from './types';
import { ColoringEditor } from './ColoringEditor';
import { FontSizeEditor } from './FontSizeEditor';
import { SparklineEditor } from './SparklineEditor';

export class SingleStatEditor extends PureComponent<PanelEditorProps<SingleStatOptions>> {
  onScaleChanged = (scale: Scale) => {
    const fieldOptions = this.props.options.fieldOptions;
    const defaults = {
      ...fieldOptions.defaults,
      scale,
    };
    this.onDisplayOptionsChanged({
      ...fieldOptions,
      defaults,
    });
  };
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
          <PanelOptionsGroup title="Display">
            <FieldDisplayEditor onChange={this.onDisplayOptionsChanged} value={fieldOptions} />
          </PanelOptionsGroup>

          <PanelOptionsGroup title="Field (default)">
            <FieldPropertiesEditor showMinMax={true} onChange={this.onDefaultsChange} value={fieldOptions.defaults} />
          </PanelOptionsGroup>

          <FontSizeEditor options={options} onChange={this.props.onOptionsChange} />
          <ColoringEditor options={options} onChange={this.props.onOptionsChange} />
          <SparklineEditor options={options.sparkline} onChange={this.onSparklineChanged} />

          <ThresholdsEditor onChange={this.onScaleChanged} scale={fieldOptions.defaults.scale} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={fieldOptions.mappings} />
      </>
    );
  }
}
