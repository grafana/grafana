// Libraries
import React, { PureComponent } from 'react';
import { PanelOptionsGrid, FieldDisplayEditor, Switch, PanelOptionsGroup } from '@grafana/ui';
import { PanelEditorProps, FieldDisplayOptions } from '@grafana/data';

import { GaugeOptions } from './types';

export class GaugePanelEditor extends PureComponent<PanelEditorProps<GaugeOptions>> {
  labelWidth = 6;

  onToggleThresholdLabels = () =>
    this.props.onOptionsChange({ ...this.props.options, showThresholdLabels: !this.props.options.showThresholdLabels });

  onToggleThresholdMarkers = () =>
    this.props.onOptionsChange({
      ...this.props.options,
      showThresholdMarkers: !this.props.options.showThresholdMarkers,
    });

  onDisplayOptionsChanged = (
    fieldOptions: FieldDisplayOptions,
    event?: React.SyntheticEvent<HTMLElement>,
    callback?: () => void
  ) => {
    this.props.onOptionsChange(
      {
        ...this.props.options,
        fieldOptions,
      },
      callback
    );
  };

  render() {
    const { options } = this.props;
    const { showThresholdLabels, showThresholdMarkers, fieldOptions } = options;

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Display">
            <FieldDisplayEditor
              onChange={this.onDisplayOptionsChanged}
              value={fieldOptions}
              labelWidth={this.labelWidth}
            />
            <Switch
              label="Labels"
              labelClass={`width-${this.labelWidth}`}
              checked={showThresholdLabels}
              onChange={this.onToggleThresholdLabels}
            />
            <Switch
              label="Markers"
              labelClass={`width-${this.labelWidth}`}
              checked={showThresholdMarkers}
              onChange={this.onToggleThresholdMarkers}
            />
          </PanelOptionsGroup>
        </PanelOptionsGrid>
      </>
    );
  }
}
