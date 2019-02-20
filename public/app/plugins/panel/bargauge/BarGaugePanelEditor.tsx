// Libraries
import React, { PureComponent } from 'react';

// Components
import { SingleStatValueEditor } from 'app/plugins/panel/gauge/SingleStatValueEditor';
import { ThresholdsEditor, ValueMappingsEditor, PanelOptionsGrid, PanelOptionsGroup, FormField } from '@grafana/ui';

// Types
import { FormLabel, PanelEditorProps, Threshold, Select, ValueMapping } from '@grafana/ui';
import { BarGaugeOptions, orientationOptions } from './types';
import { SingleStatValueOptions } from '../gauge/types';

export class BarGaugePanelEditor extends PureComponent<PanelEditorProps<BarGaugeOptions>> {
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

  onValueOptionsChanged = (valueOptions: SingleStatValueOptions) =>
    this.props.onChange({
      ...this.props.options,
      valueOptions,
    });

  onMinValueChange = ({ target }) => this.props.onChange({ ...this.props.options, minValue: target.value });
  onMaxValueChange = ({ target }) => this.props.onChange({ ...this.props.options, maxValue: target.value });
  onOrientationChange = ({ value }) => this.props.onChange({ ...this.props.options, orientation: value });

  render() {
    const { options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          <SingleStatValueEditor onChange={this.onValueOptionsChanged} options={options.valueOptions} />
          <PanelOptionsGroup title="Gauge">
            <FormField label="Min value" labelWidth={8} onChange={this.onMinValueChange} value={options.minValue} />
            <FormField label="Max value" labelWidth={8} onChange={this.onMaxValueChange} value={options.maxValue} />
            <div className="form-field">
              <FormLabel width={8}>Orientation</FormLabel>
              <Select
                width={12}
                options={orientationOptions}
                defaultValue={orientationOptions[0]}
                onChange={this.onOrientationChange}
                value={orientationOptions.find(item => item.value === options.orientation)}
              />
            </div>
          </PanelOptionsGroup>
          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={options.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={options.valueMappings} />
      </>
    );
  }
}
