// Libraries
import React, { PureComponent } from 'react';

import { PanelOptionsGrid, FieldDisplayEditor, PanelOptionsGroup, FormLabel, Select, Switch } from '@grafana/ui';
import { FieldDisplayOptions, PanelEditorProps } from '@grafana/data';
import { BarGaugeOptions, displayModes } from './types';
import { orientationOptions } from '../gauge/types';

export class BarGaugePanelEditor extends PureComponent<PanelEditorProps<BarGaugeOptions>> {
  onDisplayOptionsChanged = (fieldOptions: FieldDisplayOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      fieldOptions,
    });

  onOrientationChange = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, orientation: value });
  onDisplayModeChange = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, displayMode: value });
  onToggleShowUnfilled = () => {
    this.props.onOptionsChange({ ...this.props.options, showUnfilled: !this.props.options.showUnfilled });
  };

  render() {
    const { options } = this.props;
    const { fieldOptions } = options;

    const labelWidth = 6;

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Display">
            <FieldDisplayEditor onChange={this.onDisplayOptionsChanged} value={fieldOptions} labelWidth={labelWidth} />
            <div className="form-field">
              <FormLabel width={labelWidth}>Orientation</FormLabel>
              <Select
                width={12}
                options={orientationOptions}
                defaultValue={orientationOptions[0]}
                onChange={this.onOrientationChange}
                value={orientationOptions.find(item => item.value === options.orientation)}
              />
            </div>
            <div className="form-field">
              <FormLabel width={labelWidth}>Mode</FormLabel>
              <Select
                width={12}
                options={displayModes}
                defaultValue={displayModes[0]}
                onChange={this.onDisplayModeChange}
                value={displayModes.find(item => item.value === options.displayMode)}
              />
            </div>
            {options.displayMode !== 'lcd' && (
              <Switch
                label="Unfilled"
                labelClass={`width-${labelWidth}`}
                checked={options.showUnfilled}
                onChange={this.onToggleShowUnfilled}
              />
            )}
          </PanelOptionsGroup>
        </PanelOptionsGrid>
      </>
    );
  }
}
