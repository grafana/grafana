// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processTimeSeries, ThemeContext } from '@grafana/ui';

// Components
import { Piechart } from '@grafana/ui';

// Types
import { PiechartOptions } from './types';
import { PanelProps, NullValueMode, TimeSeriesValue } from '@grafana/ui/src/types';

interface Props extends PanelProps<PiechartOptions> {}

export class PiechartPanel extends PureComponent<Props> {
  render() {
    const { panelData, width, height, options } = this.props;

    let value: TimeSeriesValue;

    if (panelData.timeSeries) {
      const vmSeries = processTimeSeries({
        timeSeries: panelData.timeSeries,
        nullValueMode: NullValueMode.Null,
      });

      if (vmSeries[0]) {
        value = vmSeries[0].stats[options.stat];
      } else {
        value = null;
      }
    } else if (panelData.tableData) {
      value = panelData.tableData.rows[0].find(prop => prop > 0);
    }

    return (
      <ThemeContext.Consumer>
        {theme => <Piechart value={value} {...this.props.options} width={width} height={height} theme={theme} />}
      </ThemeContext.Consumer>
    );
  }
}
