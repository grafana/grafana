// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { config } from 'app/core/config';

// Components
import { Gauge, DataLinksContextMenu } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { VizRepeater } from '@grafana/ui';
import { FieldDisplay, getFieldDisplayValues, VizOrientation, PanelProps } from '@grafana/data';
import { getFieldLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';

export class GaugePanel extends PureComponent<PanelProps<GaugeOptions>> {
  renderValue = (value: FieldDisplay, width: number, height: number): JSX.Element => {
    const { options } = this.props;
    const { field, display } = value;

    return (
      <DataLinksContextMenu links={getFieldLinksSupplier(value)}>
        {({ openMenu, targetClassName }) => {
          return (
            <Gauge
              value={display}
              width={width}
              height={height}
              thresholds={field.thresholds}
              showThresholdLabels={options.showThresholdLabels}
              showThresholdMarkers={options.showThresholdMarkers}
              minValue={field.min}
              maxValue={field.max}
              theme={config.theme}
              onClick={openMenu}
              className={targetClassName}
            />
          );
        }}
      </DataLinksContextMenu>
    );
  };

  getValues = (): FieldDisplay[] => {
    const { data, options, replaceVariables } = this.props;
    return getFieldDisplayValues({
      fieldOptions: options.fieldOptions,
      replaceVariables,
      theme: config.theme,
      data: data.series,
    });
  };

  render() {
    const { height, width, data, renderCounter } = this.props;
    return (
      <VizRepeater
        getValues={this.getValues}
        renderValue={this.renderValue}
        width={width}
        height={height}
        source={data}
        renderCounter={renderCounter}
        orientation={VizOrientation.Auto}
      />
    );
  }
}
