import React, { PureComponent } from 'react';

import { FieldDisplay, getDisplayProcessor, getFieldDisplayValues, PanelProps } from '@grafana/data';
import { DataLinksContextMenu, Gauge, VizRepeater, VizRepeaterRenderValueProps } from '@grafana/ui';
import { DataLinksContextMenuApi } from '@grafana/ui/src/components/DataLinks/DataLinksContextMenu';
import { config } from 'app/core/config';

import { clearNameForSingleSeries } from '../bargauge/BarGaugePanel';

import { Options } from './panelcfg.gen';

export class GaugePanel extends PureComponent<PanelProps<Options>> {
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
        text={options.text}
        showThresholdLabels={options.showThresholdLabels}
        showThresholdMarkers={options.showThresholdMarkers}
        theme={config.theme2}
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
        <DataLinksContextMenu links={getLinks} style={{ flexGrow: 1 }}>
          {(api) => {
            return this.renderComponent(valueProps, api);
          }}
        </DataLinksContextMenu>
      );
    }

    return this.renderComponent(valueProps, {});
  };

  getValues = (): FieldDisplay[] => {
    const { data, options, replaceVariables, fieldConfig, timeZone } = this.props;

    for (let frame of data.series) {
      for (let field of frame.fields) {
        // Set the Min/Max value automatically for percent and percentunit
        if (field.config.unit === 'percent' || field.config.unit === 'percentunit') {
          const min = field.config.min ?? 0;
          const max = field.config.max ?? (field.config.unit === 'percent' ? 100 : 1);
          field.state = field.state ?? {};
          field.state.range = { min, max, delta: max - min };
          field.display = getDisplayProcessor({ field, theme: config.theme2 });
        }
      }
    }
    return getFieldDisplayValues({
      fieldConfig,
      reduceOptions: options.reduceOptions,
      replaceVariables,
      theme: config.theme2,
      data: data.series,
      timeZone,
    });
  };

  render() {
    const { height, width, data, renderCounter, options } = this.props;

    return (
      <VizRepeater
        getValues={this.getValues}
        renderValue={this.renderValue}
        width={width}
        height={height}
        source={data}
        autoGrid={true}
        renderCounter={renderCounter}
        orientation={options.orientation}
      />
    );
  }
}
