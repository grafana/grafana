// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processTimeSeries, ThemeContext } from '@grafana/ui';

// Components
import { Piechart, PiechartDataPoint } from '@grafana/ui';

// Types
import { PiechartOptions } from './types';
import { PanelProps, NullValueMode } from '@grafana/ui/src/types';

interface Props extends PanelProps<PiechartOptions> {}

export class PiechartPanel extends PureComponent<Props> {
  render() {
    const { panelData, width, height, options } = this.props;
    const { valueOptions } = options;

    const datapoints: PiechartDataPoint[] = [];
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
          <Piechart
            width={width}
            height={height}
            datapoints={datapoints}
            pieType={options.pieType}
            unit={options.unit}
            stat={options.stat}
            strokeWidth={options.strokeWidth}
            theme={theme}
          />
        )}
      </ThemeContext.Consumer>
    );
  }
}
