// Libraries
import React, { PureComponent } from 'react';

// Utils & Services
import { config } from 'app/core/config';

// Types
import { SingleStatOptions } from './types';
import { VizRepeater, BigValue, DataLinksContextMenu, BigValueSparkline } from '@grafana/ui';
import { PanelProps, getFieldDisplayValues, FieldDisplay } from '@grafana/data';
import { getFieldLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';

export class SingleStatPanel extends PureComponent<PanelProps<SingleStatOptions>> {
  renderValue = (value: FieldDisplay, width: number, height: number): JSX.Element => {
    const { timeRange, options } = this.props;
    let sparkline: BigValueSparkline | undefined;

    if (value.sparkline) {
      sparkline = {
        ...options.sparkline,
        data: value.sparkline,
        minX: timeRange.from.valueOf(),
        maxX: timeRange.to.valueOf(),
      };
    }

    return (
      <DataLinksContextMenu links={getFieldLinksSupplier(value)}>
        {({ openMenu, targetClassName }) => {
          return (
            <BigValue
              value={value.display}
              sparkline={sparkline}
              displayMode={options.displayMode}
              width={width}
              height={height}
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
      ...options,
      replaceVariables,
      theme: config.theme,
      data: data.series,
      sparkline: options.sparkline.show,
    });
  };

  render() {
    const { height, width, options, data, renderCounter } = this.props;
    return (
      <VizRepeater
        getValues={this.getValues}
        renderValue={this.renderValue}
        width={width}
        height={height}
        source={data}
        renderCounter={renderCounter}
        orientation={options.orientation}
      />
    );
  }
}
