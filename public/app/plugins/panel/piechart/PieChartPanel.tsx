// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processTimeSeries, ThemeContext } from '@grafana/ui';

// Components
import { PieChart, PieChartDataPoint } from '@grafana/ui';

// Types
import { PieChartOptions } from './types';
import { PanelProps, NullValueMode } from '@grafana/ui/src/types';

interface Props extends PanelProps<PieChartOptions> {}

export class PieChartPanel extends PureComponent<Props> {
  render() {
    const { panelData, width, height, options } = this.props;
    const { valueOptions } = options;

    const datapoints: PieChartDataPoint[] = [];
    if (panelData.timeSeries) {
      const vmSeries = processTimeSeries({
        timeSeries: panelData.timeSeries,
        nullValueMode: NullValueMode.Null,
      });

      for (let i = 0; i < vmSeries.length; i++) {
        const serie = vmSeries[i];
        if (serie) {
          datapoints.push({
            value: serie.stats[valueOptions.stat],
            name: serie.label,
            color: serie.color,
          });
        }
      }
    }
    // TODO: support table data

    return (
      <ThemeContext.Consumer>
        {theme => (
          <PieChart
            width={width}
            height={height}
            datapoints={datapoints}
            pieType={options.pieType}
            strokeWidth={options.strokeWidth}
            unit={valueOptions.unit}
            theme={theme}
          />
        )}
      </ThemeContext.Consumer>
    );
  }
}
