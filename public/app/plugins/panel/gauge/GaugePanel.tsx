// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { config } from 'app/core/config';

// Components
import { Gauge, DataLinksContextMenu, VizRepeater, VizRepeaterRenderValueProps } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { FieldDisplay, getFieldDisplayValues, VizOrientation, PanelProps } from '@grafana/data';

export class GaugePanel extends PureComponent<PanelProps<GaugeOptions>> {
  renderValue = (valueProps: VizRepeaterRenderValueProps<FieldDisplay>): JSX.Element => {
    const { options } = this.props;
    const { value, width, height } = valueProps;
    const { field, display } = value;

    return (
      <DataLinksContextMenu links={value.getLinks}>
        {({ openMenu, targetClassName }) => {
          return (
            <Gauge
              value={display}
              width={width}
              height={height}
              field={field}
              showThresholdLabels={options.showThresholdLabels}
              showThresholdMarkers={options.showThresholdMarkers}
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
    const { data, options, replaceVariables, fieldConfig, timeZone } = this.props;
    return getFieldDisplayValues({
      fieldConfig,
      reduceOptions: options.reduceOptions,
      replaceVariables,
      theme: config.theme,
      data: data.series,
      autoMinMax: true,
      timeZone,
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
        autoGrid={true}
        renderCounter={renderCounter}
        orientation={VizOrientation.Auto}
      />
    );
  }
}
