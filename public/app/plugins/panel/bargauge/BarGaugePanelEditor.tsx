// Libraries
import React, { PureComponent } from 'react';

// Components
import { SingleStatValueEditor } from 'app/plugins/panel/gauge/SingleStatValueEditor';
import {
  PanelOptionsGrid,
  PanelOptionsGroup,
  FormField,
  DisplayValueOptions,
  ThresholdsEditor,
  Threshold,
} from '@grafana/ui';

// Types
import { FormLabel, PanelEditorProps, Select, ValueMappingsEditor, ValueMapping } from '@grafana/ui';
import { BarGaugeOptions, orientationOptions } from './types';
import { DisplayValueEditor } from '../gauge/DisplayValueEditor';

export class BarGaugePanelEditor extends PureComponent<PanelEditorProps<BarGaugeOptions>> {
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

  onMinValueChange = ({ target }) => this.props.onOptionsChange({ ...this.props.options, minValue: target.value });
  onMaxValueChange = ({ target }) => this.props.onOptionsChange({ ...this.props.options, maxValue: target.value });
  onOrientationChange = ({ value }) => this.props.onOptionsChange({ ...this.props.options, orientation: value });

  render() {
    const { onOptionsChange, options } = this.props;
    const { display } = options;

    return (
      <>
        <PanelOptionsGrid>
          {/* This just sets the 'stats', that should be moved to somethign more general */}
          <SingleStatValueEditor onChange={onOptionsChange} options={options} />

          <DisplayValueEditor onChange={this.onDisplayOptionsChanged} options={display} />

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
          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={display.thresholds} />
          <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={display.mappings} />
        </PanelOptionsGrid>
      </>
    );
  }
}
