// Libraries
import React, { PureComponent } from 'react';

import { PanelOptionsGrid, FieldDisplayEditor, PanelOptionsGroup, FormLabel, Select } from '@grafana/ui';

import { PanelEditorProps, FieldDisplayOptions } from '@grafana/data';

import { StatPanelOptions, colorModes, graphModes, justifyModes } from './types';
import { orientationOptions } from '../gauge/types';

export class StatPanelEditor extends PureComponent<PanelEditorProps<StatPanelOptions>> {
  onDisplayOptionsChanged = (fieldOptions: FieldDisplayOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      fieldOptions,
    });

  onColorModeChanged = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, colorMode: value });
  onGraphModeChanged = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, graphMode: value });
  onJustifyModeChanged = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, justifyMode: value });
  onOrientationChange = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, orientation: value });

  render() {
    const { options } = this.props;
    const { fieldOptions } = options;

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Display">
            <FieldDisplayEditor onChange={this.onDisplayOptionsChanged} value={fieldOptions} labelWidth={8} />
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
            <div className="form-field">
              <FormLabel width={8}>Color</FormLabel>
              <Select
                width={12}
                options={colorModes}
                defaultValue={colorModes[0]}
                onChange={this.onColorModeChanged}
                value={colorModes.find(item => item.value === options.colorMode)}
              />
            </div>
            <div className="form-field">
              <FormLabel width={8}>Graph</FormLabel>
              <Select
                width={12}
                options={graphModes}
                defaultValue={graphModes[0]}
                onChange={this.onGraphModeChanged}
                value={graphModes.find(item => item.value === options.graphMode)}
              />
            </div>
            <div className="form-field">
              <FormLabel width={8}>Justify</FormLabel>
              <Select
                width={12}
                options={justifyModes}
                defaultValue={justifyModes[0]}
                onChange={this.onJustifyModeChanged}
                value={justifyModes.find(item => item.value === options.justifyMode)}
              />
            </div>
          </PanelOptionsGroup>
        </PanelOptionsGrid>
      </>
    );
  }
}
