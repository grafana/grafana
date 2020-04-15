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

    const linksSupplier = value.view?.dataFrame.fields[value.colIndex].getDataLinksSupplier;
    return (
      <DataLinksContextMenu
        links={
          linksSupplier
            ? linksSupplier({
                calculatedValue: value,
                valueRowIndex: value.rowIndex,
              })
            : null
        }
      >
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
    const { data, options, replaceVariables, fieldConfig } = this.props;
    return getFieldDisplayValues({
      fieldConfig,
      reduceOptions: options.reduceOptions,
      replaceVariables,
      theme: config.theme,
      data: data.series,
      autoMinMax: true,
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
