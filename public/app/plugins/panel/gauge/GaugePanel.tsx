import React, { PureComponent } from 'react';
import { FieldDisplay, getFieldDisplayValues, PanelProps, VizOrientation } from '@grafana/data';
import { DataLinksContextMenu, Gauge, VizRepeater, VizRepeaterRenderValueProps } from '@grafana/ui';
import { DataLinksContextMenuApi } from '@grafana/ui/src/components/DataLinks/DataLinksContextMenu';

import { config } from 'app/core/config';
import { GaugeOptions } from './types';
import { clearNameForSingleSeries } from '../bargauge/BarGaugePanel';

export class GaugePanel extends PureComponent<PanelProps<GaugeOptions>> {
  renderComponent = (
    valueProps: VizRepeaterRenderValueProps<FieldDisplay>,
    menuProps: DataLinksContextMenuApi
  ): JSX.Element => {
    const { options, fieldConfig } = this.props;
    const { width, height, count, value } = valueProps;
    const { field, display } = value;
    const { openMenu, targetClassName } = menuProps;

    return (
      <Gauge
        value={clearNameForSingleSeries(count, fieldConfig.defaults, display)}
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
  };

  renderValue = (valueProps: VizRepeaterRenderValueProps<FieldDisplay>): JSX.Element => {
    const { value } = valueProps;
    const { getLinks, hasLinks } = value;

    if (hasLinks && getLinks) {
      return (
        <DataLinksContextMenu links={getLinks}>
          {api => {
            return this.renderComponent(valueProps, api);
          }}
        </DataLinksContextMenu>
      );
    }

    return this.renderComponent(valueProps, {});
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
